import { InjectModel } from '@nestjs/mongoose';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { User } from '../user/auth/signup/entities/user.entity';
import { ENV } from '../utils/config/env.config';
import { verify, JwtPayload } from 'jsonwebtoken'
import { NotificationService } from './notification.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
// @WebSocketGateway()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSocketMap = new Map<string, string>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) { }

  afterInit(server: Server) {
    const middleware = this.createAuthMiddleware();
    server.use(middleware);
  }

  private createAuthMiddleware() {
    return async (socket: Socket, next) => {
      try {
        const token = socket.handshake.headers.authorization;

        if (!token) {
          console.log("No token provided");
          return next(new Error('Authentication token missing'));
        }

        const payload = verify(token, ENV.JWT_SECRET) as JwtPayload;
        const userId = payload.id;

        const user = await this.userModel.findById(userId);
        if (!user) {
          console.log("User not found:", userId);
          return next(new Error('User not found'));
        }

        (socket as any).user = user;
        next();
      } catch (error) {
        console.log("Auth error:", error.message);
        next(new Error('Authentication failed: ' + error.message));
      }
    };
  }

  async handleConnection(client: Socket) {
    const userId = (client as any).user._id;

    if (!userId) {
      client.disconnect();
      return;
    }

    // Store userId in socket data for easy reference
    client.data.userId = userId.toString();

    // this.userSocketMap.set(userId.toString(), client.id);
    // console.log(this.userSocketMap)

    client.join(`user-${userId}`);

    // Send unread notifications when user connects
    const unreadNotifications = await this.notificationService.getUnreadNotifications(userId);
    if (unreadNotifications.length > 0) {
      // Send to all connected devices for this user (including this one)
      this.server.to(`user-${userId}`).emit('unreadNotifications', unreadNotifications);
    }

    // Send unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    // Send to all connected devices for this user (including this one)
    this.server.to(`user-${userId}`).emit('unreadCount', unreadCount);
  }


  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    console.log(`User ${userId} automatically left all rooms`);
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, payload: { notificationIds: string[] }) {
    // const userId = this.getUserIdFromSocketId(client.id);
    // if (!userId) return;

    const userId = client.data.userId;
    if (!userId) return;

    await this.notificationService.markAsRead(userId, payload.notificationIds);

    // send updated unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    // client.emit('unreadCount', unreadCount);
    this.server.to(`user-${userId}`).emit('unreadCount', unreadCount);
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    await this.notificationService.markAllAsRead(userId);
    this.server.to(`user-${userId}`).emit('unreadCount', 0);
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const notifications = await this.notificationService.getAllNotifications(userId);
    this.server.to(`user-${userId}`).emit('notifications', notifications);
  }

  @SubscribeMessage('clearAllNotifications')
  async handleClearAllNotifications(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const notifications = await this.notificationService.clearAllNotifications(userId);
    this.server.to(`user-${userId}`).emit('notifications', notifications);
    this.server.to(`user-${userId}`).emit('unreadCount', 0);
  }

  async sendNotification(userId: string, notificationData: any) {
    console.log("Sending notification to user", userId);

    // Store notification in database
    const notification = await this.notificationService.storeNotification(userId, notificationData);

    // Send notification to all user's connected devices using room-based approach
    // No need to check if user is online - if they have no active connections, 
    // the message simply won't be delivered to anyone
    this.server.to(`user-${userId}`).emit('notification', notification);

    // Also update unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    this.server.to(`user-${userId}`).emit('unreadCount', unreadCount);

    console.log(`Notification sent to room user-${userId}`);
    return notification;
  }

  private getUserIdFromSocketId(socketId: string): string | null {
    for (const [userId, id] of this.userSocketMap.entries()) {
      if (id === socketId) return userId;
    }
    return null;
  }

}
