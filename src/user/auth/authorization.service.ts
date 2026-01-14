// auth/services/authorization.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/shared/entities/user.entity';

@Injectable()
export class AuthorizationService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>
    ) { }

    /**
     * Validates if a user has admin privileges
     * @param userId The ID of the user to check
     * @throws ForbiddenException if the user is not an admin
     */
    async validateAdmin(userId: string): Promise<void> {
        if (!userId) throw new ForbiddenException('User not authenticated');

        const user = await this.userModel.findById(userId).exec();

        if (!user) throw new NotFoundException('User not found');

        if (!user.isAdmin) throw new ForbiddenException('Access denied: Admin privileges required');
    }

    /**
     * Validates if a user is the owner of a resource or an admin
     * @param userId The ID of the user to check
     * @param ownerId The ID of the resource owner
     * @throws ForbiddenException if the user is neither the owner nor an admin
     */
    async validateOwnerOrAdmin(userId: string, ownerId: string): Promise<void> {
        if (!userId) throw new ForbiddenException('User not authenticated');

        // If user is the owner, allow access
        if (userId.toString() === ownerId.toString()) {
            return;
        }

        // Otherwise, check if user is an admin
        await this.validateAdmin(userId);
    }
}
