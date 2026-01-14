import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Connection, Document, Model, Types } from 'mongoose';
import { ChapterMember } from 'src/shared/entities/chapters/chapter-member.entity';
import { Chapter } from 'src/shared/entities/chapters/chapter.entity';
import { Club } from 'src/shared/entities/club.entity';
import { ClubMembers } from 'src/shared/entities/clubmembers.entity';
import { DeleteChapterDto, JoinUserChapterDto, LeaveUserChapterDto, RemoveUserChapterDto, RoleAccessDto, UpdateChapterStatusDto } from './dto/chapter.dto';
import { NodeMembers } from 'src/shared/entities/node-members.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { Projects } from 'src/shared/entities/projects/project.entity';
import { ChapterProject } from 'src/shared/entities/chapters/modules/chapter-projects.entity';
import { RulesRegulations } from 'src/shared/entities/rules/rules-regulations.entity';
import { ChapterRuleRegulations } from 'src/shared/entities/chapters/modules/chapter-rule-regulations.entity';
import { GroupChat } from 'src/shared/entities/chat/group-chat.entity';
import { ChatMessage } from 'src/shared/entities/chat/chat-message.entity';
import { Debate } from 'src/shared/entities/debate/debate.entity';
import { ChapterIssues } from 'src/shared/entities/chapters/modules/chapter-issues.entity';
import { ChapterDebates } from 'src/shared/entities/chapters/modules/chapter-debates.entity';
import { Issues } from 'src/shared/entities/issues/issues.entity';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { StdAssetAdoption } from 'src/shared/entities/standard-plugin/std-asset-adoption.entity';
import { IssuesAdoption } from 'src/shared/entities/issues/issues-adoption.entity';
import { DebateAdoption } from 'src/shared/entities/debate/debate-adoption-entity';
import { ProjectAdoption } from 'src/shared/entities/projects/project-adoption.entity';
import { RulesAdoption } from 'src/shared/entities/rules/rules-adoption.entity';
import { ForumProfile } from 'src/shared/entities/forum-profile.entity';
import { UploadService } from 'src/shared/upload/upload.service';

@Injectable()
export class ChapterService {
    constructor(

        // FORUM MODELS
        @InjectModel(Club.name) private readonly clubModel: Model<Club>,
        @InjectModel(Node_.name) private readonly nodeModel: Model<Node_>,
        @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
        @InjectModel(ForumProfile.name) private readonly forumProfileModel: Model<ForumProfile>,

        // ASSET MODELS
        @InjectModel(RulesRegulations.name) private readonly rulesRegulationsModel: Model<RulesRegulations>,
        @InjectModel(Issues.name) private readonly issuesModel: Model<Issues>,
        @InjectModel(Debate.name) private readonly debateModel: Model<Debate>,
        @InjectModel(Projects.name) private readonly ProjectModel: Model<Projects>,
        @InjectModel(StdPluginAsset.name) private readonly stdAssetModel: Model<StdPluginAsset>,

        // ASSET ADOPTION MODELS
        @InjectModel(RulesAdoption.name) private readonly rulesAdoptionModel: Model<RulesAdoption>,
        @InjectModel(IssuesAdoption.name) private readonly issuesAdoptionModel: Model<IssuesAdoption>,
        @InjectModel(DebateAdoption.name) private readonly debateAdoptionModel: Model<DebateAdoption>,
        @InjectModel(ProjectAdoption.name) private readonly projectAdoptionModel: Model<ProjectAdoption>,
        @InjectModel(StdAssetAdoption.name) private readonly stdAssetAdoptionModel: Model<StdAssetAdoption>,

        // MEMBERSHIP MODELS
        @InjectModel(ClubMembers.name) private readonly clubMembersModel: Model<ClubMembers>,
        @InjectModel(ChapterMember.name) private readonly chapterMemberModel: Model<ChapterMember>,
        @InjectModel(NodeMembers.name) private readonly nodeMembersModel: Model<NodeMembers>,

        // CHAPTER ADOPTION MODELS
        @InjectModel(ChapterRuleRegulations.name) private readonly chapterRuleRegulationsModel: Model<ChapterRuleRegulations>,
        @InjectModel(ChapterIssues.name) private readonly chapterIssueModel: Model<ChapterIssues>,
        @InjectModel(ChapterDebates.name) private readonly chapterDebateModel: Model<ChapterDebates>,
        @InjectModel(ChapterProject.name) private readonly chapterProjectModel: Model<ChapterDebates>,

        @InjectModel(GroupChat.name) private readonly groupChatModel: Model<GroupChat>,
        @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,

        @InjectConnection() private connection: Connection,
        private readonly uploadService: UploadService,
    ) { }

    //----------------CREATE CHAPTER------------------

    /**
     * Creates a new chapter. The chapter is automatically published if the user is an
     * owner, admin, or moderator of the club. Otherwise, the chapter is proposed and
     * requires approval from a privileged user.
     * @param createChapterDto - The request body containing the club id and node id.
     * @param userData - The user data containing the user id and role.
     * @returns A promise that resolves to the created chapter, or an error object if there was an error.
     * @throws `NotFoundException` if the club is not found.
     * @throws `Error` if there was an error while trying to create the chapter.
     */
    async createChapter(createChapterDto: any, userData: any) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const { userRole, userId } = userData;
            const { club, node } = createChapterDto;


            const existedClub = await this.clubModel.findById(new Types.ObjectId(club)).session(session);

            if (!existedClub) throw new NotFoundException('Club not found');


            const existedNode = await this.nodeModel.findById(new Types.ObjectId(node)).session(session);

            if (!existedNode) throw new NotFoundException('Node not found');


            const existedChapter = await this.chapterModel.findOne({
                node: new Types.ObjectId(node),
                club: new Types.ObjectId(club)
            }).session(session);

            if (existedChapter) throw new Error('Chapter already exists');

            const isPrivilegedUser = ['owner', 'admin', 'moderator'].includes(userRole);

            const newChapterData: any = {
                name: `${existedClub.name} - ${existedNode.name}`,
                about: existedClub.about,
                description: existedClub.description,
                profileImage: existedClub.profileImage,
                club: new Types.ObjectId(club),
                node: new Types.ObjectId(node),
                status: isPrivilegedUser ? 'published' : 'proposed',
                proposedBy: new Types.ObjectId(userId),
                publishedBy: isPrivilegedUser ? new Types.ObjectId(userId) : null,
                domain: existedClub.domain,
            }

            if (existedClub.coverImage) {
                console.log("hai")
                newChapterData.coverImage = existedClub.coverImage;
            }

            const chapterData = new this.chapterModel(newChapterData);

            const chapter = await chapterData.save({ session });

            if (isPrivilegedUser) {
                const validRoles = ['admin', 'moderator', 'member'];
                const assignedRole = userRole === 'owner' ? 'admin' : userRole;

                if (!validRoles.includes(assignedRole)) {
                    throw new Error('Invalid user role');
                }

                const chapterMemberData = new this.chapterMemberModel({
                    chapter: chapter._id,
                    user: new Types.ObjectId(userId),
                    role: assignedRole,
                    status: 'MEMBER',
                })

                await chapterMemberData.save({ session });

                await this.clubMembersModel.findOneAndUpdate(
                    {
                        club: new Types.ObjectId(club),
                        user: new Types.ObjectId(userId)
                    },
                    {
                        $setOnInsert: {
                            club: new Types.ObjectId(club),
                            user: new Types.ObjectId(userId),
                            role: 'member',
                            status: 'MEMBER',
                        }
                    },
                    {
                        upsert: true,
                        session,
                        runValidators: true
                    }
                );

                //chapter group chat for admins of the chapter and club owner and admins
                const clubOwnerAndAdmins = await this.clubMembersModel.find({
                    club: new Types.ObjectId(club),
                    role: { $in: ['owner', 'admin'] }
                }).session(session);

                let members = clubOwnerAndAdmins.map(member => ({
                    user: member.user,
                    isClub: true,
                    isChapter: false
                }));

                if (assignedRole === 'admin') {
                    const newUserId = new Types.ObjectId(userId);
                    const existingMemberIndex = members.findIndex(m => m.user.equals(newUserId));

                    if (existingMemberIndex === -1) {
                        members.push({
                            user: newUserId,
                            isClub: false,
                            isChapter: true
                        });
                    } else {
                        members[existingMemberIndex].isChapter = true;
                    }
                }

                const groupChatData: any = {
                    chapter: chapter._id,
                    club: new Types.ObjectId(club),
                    name: chapter.name,
                    profileImage: chapter.profileImage,
                    members,
                }

                if (chapter.coverImage) {
                    groupChatData.coverImage = chapter.coverImage;
                }

                const newGroupChat = new this.groupChatModel(groupChatData)

                await newGroupChat.save({ session });
            }

            // Copy Assets from Club to Chapter
            await this.copyClubAssetsToChapter({ chapter, club, userId, publishedStatus: isPrivilegedUser ? 'published' : 'proposed', session })
            await this.adoptStdAssetsToChapter({ chapter, club, userId, publishedStatus: isPrivilegedUser ? 'published' : 'proposed', session });


            await session.commitTransaction();

            return chapter

        } catch (error) {
            console.log('error creating chapter', error);
            await session.abortTransaction();
            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new Error(`Failed to create chapter: ${error.message}`);
        } finally {
            session.endSession();
        }
    }

    private async copyClubAssetsToChapter({
        chapter,
        club,
        userId,
        publishedStatus,
        session
    }: {
        chapter: Document<unknown, {}, Chapter> & Chapter & Required<{ _id: unknown }> & { __v: number };
        club: Types.ObjectId | string;
        userId: string;
        publishedStatus: 'published' | 'proposed';
        session: ClientSession;
    }) {
        try {
            const modules = [
                {
                    model: this.rulesRegulationsModel as Model<any>,
                    targetModel: this.rulesAdoptionModel as Model<any>,
                    key: "rule"
                },
                {
                    model: this.issuesModel as Model<any>,
                    targetModel: this.issuesAdoptionModel as Model<any>,
                    key: "issues"
                },
                {
                    model: this.debateModel as Model<any>,
                    targetModel: this.debateAdoptionModel as Model<any>,
                    key: "debate"
                },
                {
                    model: this.ProjectModel as Model<any>,
                    targetModel: this.projectAdoptionModel as Model<any>,
                    key: "project"
                }
            ];

            for (const { model, targetModel, key } of modules) {
                const clubAssets = await model.find({
                    club: new Types.ObjectId(club.toString()),
                    publishedStatus: "published"
                }).sort({ createdAt: -1 }).session(session).exec();


                if (clubAssets.length) {
                    const chapterAssetsToInsert = clubAssets.map(asset => ({
                        [key]: asset._id,
                        chapter: chapter._id,
                        proposedBy: new Types.ObjectId(userId),
                        ...(publishedStatus === 'published' && { acceptedBy: new Types.ObjectId(userId) }),

                        publishedStatus
                    }));

                    console.log({ chapterAssetsToInsert })

                    const chapterAssets = await targetModel.insertMany(chapterAssetsToInsert, { session });

                    console.log({ chapterAssets })
                }
            }
        } catch (error) {
            console.error("Error Copying assets to chapter", error);
        }
    }

    private async adoptStdAssetsToChapter({
        chapter,
        club,
        userId,
        publishedStatus,
        session
    }: {
        chapter: Document<unknown, {}, Chapter> & Chapter & Required<{ _id: unknown }> & { __v: number };
        club: Types.ObjectId | string;
        userId: string;
        publishedStatus: 'published' | 'proposed';
        session: ClientSession;
    }) {
        try {
            const assets = await this.stdAssetModel.find({ club: club, publishedStatus: 'published' }).sort({ createdAt: -1 }).session(session).exec();

            await this.stdAssetAdoptionModel.insertMany(
                assets.map(asset => ({
                    asset: asset._id,
                    plugin: asset.plugin,
                    chapter: chapter._id,
                    publishedStatus,
                    proposedBy: new Types.ObjectId(userId),
                    ...(publishedStatus === 'published' && {
                        publishedBy: new Types.ObjectId(userId),
                        publishedDate: new Date(),
                    }),
                    statusHistory: [{
                        status: publishedStatus,
                        changedBy: new Types.ObjectId(userId),
                        date: new Date(),
                        notes: 'Initial creation'
                    }],
                })),
                { session }
            );



            console.log("assets", assets);
        } catch (error) {
            console.error("Error Copying assets to chapter", error);
        }
    }

    /**
     * Retrieves all published chapters in a given node
     * @param nodeId The ID of the node to retrieve chapters from
     * @returns An array of published chapters in the node
     * @throws {NotFoundException} If the node ID is not provided
     * @throws {Error} If there is an error while retrieving chapters
     */
    async getPublishedChaptersOfNode(nodeId: Types.ObjectId) {
        try {
            if (!nodeId) {
                throw new NotFoundException('Please provide node id');
            }

            const chapters = await this.chapterModel.aggregate([
                {
                    $match: {
                        node: nodeId,
                        status: 'published',
                        isDeleted: false,
                    }
                },
                {
                    $lookup: {
                        from: 'chaptermembers',
                        let: { chapterId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$chapter', '$$chapterId'] },
                                            { $eq: ['$status', 'MEMBER'] },
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'members'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'members.user',
                        foreignField: '_id',
                        as: 'members'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        profileImage: 1,
                        coverImage: 1,
                        club: 1,
                        node: 1,
                        status: 1,
                        about: 1,
                        createdAt: 1,
                        updatedAt: 1,

                        "members._id": 1,
                        "members.userName": 1,
                        "members.email": 1,
                        "members.profileImage": 1,
                        "members.coverImage": 1,
                        "members.dateOfBirth": 1,
                        "members.firstName": 1,
                        "members.lastName": 1,
                        "members.gender": 1
                    }
                }

            ])

            return chapters;

        } catch (error) {
            console.log('error getting all published chapters of user', error);
            if (error instanceof NotFoundException) throw error;
            throw new Error('Error getting all published chapters of user');
        }
    }

    //----------------GET PUBLIC CLUBS------------------

    /**
     * Retrieves all public clubs in a given node that match a given term (case-insensitive).
     * @param nodeId The ID of the node to retrieve clubs from
     * @param term The search term to filter clubs by
     * @returns An array of public clubs in the node that match the given term
     * @throws {NotFoundException} If the node ID is not provided
     * @throws {Error} If there is an error while retrieving clubs
     */
    async getPublicClubs(nodeId: Types.ObjectId, term: string) {
        try {

            if (!nodeId) {
                throw new NotFoundException('Please provide node id');
            }

            let query = { isPublic: true } as { isPublic: boolean; name?: { $regex: string; $options: string } };
            if (term) {
                query = { isPublic: true, name: { $regex: term, $options: 'i' } }
            }

            const clubs = await this.clubModel.aggregate([
                { $match: query },

                {
                    $lookup: {
                        from: 'chapters',
                        let: { clubId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$club', '$$clubId'] },
                                            { $eq: ['$node', nodeId] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'chapters'
                    }
                },
                {
                    $match: {
                        chapters: { $size: 0 }
                    }
                },
                {
                    $project: {
                        chapters: 0
                    }
                }
            ]);

            return clubs;

        } catch (error) {
            console.log('error getting all clubs of user', error);
            if (error instanceof NotFoundException) throw error;
            throw new Error('Error getting all clubs of user');
        }
    }

    //----------------GET PROPOSED CHAPTERS OF NODE------------------

    /**
     * Retrieves all proposed chapters in a given node
     * @param nodeId The ID of the node to retrieve chapters from
     * @returns An array of proposed chapters in the node
     * @throws {NotFoundException} If the node ID is not provided or if there are no proposed chapters for the given node
     * @throws {Error} If there is an error while retrieving chapters
     */
    async getProposedChaptersOfNode(nodeId: Types.ObjectId) {
        try {

            if (!nodeId) {
                throw new NotFoundException('Please provide node id');
            }

            const nodeProposedChapters = await this.chapterModel
                .find({
                    node: new Types.ObjectId(nodeId),
                    status: 'proposed',
                    isDeleted: false,
                })
                .populate({
                    path: 'proposedBy',
                    select: '-password -isBlocked -emailVerified -registered -signupThrough -isOnBoarded -onBoardingStage -__v'
                })

            return nodeProposedChapters;

        } catch (error) {
            console.log('error getting proposed chapters of node', error);
            if (error instanceof NotFoundException) throw new NotFoundException('No proposed chapters found for the given node');
            throw new Error('Error getting proposed chapters of node');
        }
    }

    //----------------PUBLISH OR REJECT CHAPTER------------------

    /**
     * Publishes or rejects a chapter.
     * @param chapterUserData - An object containing the user's role and ID.
     * @param updateChapterStatusDto - An object containing the chapter ID and status to set.
     * @returns A promise that resolves to an object containing a message and status.
     * @throws {NotFoundException} If the chapter is not found.
     * @throws {Error} If there is an error while publishing or rejecting the chapter.
     */
    async publishOrRejectChapter(
        chapterUserData: {
            userRole: string,
            userId: Types.ObjectId,
        },
        updateChapterStatusDto: UpdateChapterStatusDto
    ) {
        const session = await this.connection.startSession();
        session.startTransaction()
        try {

            if (updateChapterStatusDto.status === 'reject') {
                await this.chapterModel.findByIdAndUpdate(
                    updateChapterStatusDto.chapterId,
                    {
                        status: 'rejected',
                        rejectedBy: new Types.ObjectId(chapterUserData.userId),
                        rejectedReason: updateChapterStatusDto.rejectedReason
                    },
                    { session, new: true }
                )

                await session.commitTransaction();

                return {
                    message: 'Chapter rejected successfully',
                    status: 'success'
                }
            }

            const existedChapter = await this.chapterModel.findByIdAndUpdate(
                updateChapterStatusDto.chapterId,
                {
                    status: 'published',
                    publishedBy: new Types.ObjectId(chapterUserData.userId)
                },
                { session, new: true }
            );

            if (!existedChapter) {
                throw new NotFoundException('Chapter not found');
            }

            // add members to chapter
            const validRoles = ['admin', 'moderator', 'member'];
            const assignedRole = chapterUserData.userRole === 'owner' ? 'admin' : chapterUserData.userRole;

            if (!validRoles.includes(assignedRole)) {
                throw new Error('Invalid user role');
            }

            const chapterPublishedMemberData = new this.chapterMemberModel({
                chapter: new Types.ObjectId(updateChapterStatusDto.chapterId),
                user: new Types.ObjectId(chapterUserData.userId),
                role: assignedRole,
                status: 'MEMBER',
            })

            await chapterPublishedMemberData.save({ session });

            const chapterProposedMemberData = new this.chapterMemberModel({
                chapter: new Types.ObjectId(updateChapterStatusDto.chapterId),
                user: new Types.ObjectId(existedChapter.proposedBy),
                role: 'member',
                status: 'MEMBER',
            })

            await chapterProposedMemberData.save({ session });

            // add members to club
            await this.clubMembersModel.findOneAndUpdate(
                {
                    club: new Types.ObjectId(existedChapter.club),
                    user: new Types.ObjectId(chapterUserData.userId)
                },
                {
                    $setOnInsert: {
                        club: new Types.ObjectId(existedChapter.club),
                        user: new Types.ObjectId(chapterUserData.userId),
                        status: 'MEMBER',
                        role: 'member',
                    }
                },
                {
                    upsert: true,
                    session,
                    runValidators: true
                }
            );

            await this.clubMembersModel.findOneAndUpdate(
                {
                    club: new Types.ObjectId(existedChapter.club),
                    user: new Types.ObjectId(existedChapter.proposedBy)
                },
                {
                    $setOnInsert: {
                        club: new Types.ObjectId(existedChapter.club),
                        user: new Types.ObjectId(existedChapter.proposedBy),
                        status: 'MEMBER',
                        role: 'member',
                    }
                },
                {
                    upsert: true,
                    session,
                    runValidators: true
                }
            );

            //chapter group chat for admins of the chapter and club owner and admins
            const clubOwnerAndAdmins = await this.clubMembersModel.find({
                club: new Types.ObjectId(existedChapter.club),
                role: { $in: ['owner', 'admin'] }
            }).session(session);

            // const members = clubOwnerAndAdmins.map(member => member.user)

            let members = clubOwnerAndAdmins.map(member => ({
                user: member.user,
                isClub: true,
                isChapter: false
            }));

            // if (assignedRole === 'admin') {
            //     const newUserId = new Types.ObjectId(chapterUserData.userId);
            //     if (!members.some(id => id.equals(newUserId))) {
            //         members.push(newUserId);
            //     }
            // };

            if (assignedRole === 'admin') {
                const newUserId = new Types.ObjectId(chapterUserData.userId);
                const existingMemberIndex = members.findIndex(m => m.user.equals(newUserId));

                if (existingMemberIndex === -1) {
                    members.push({
                        user: newUserId,
                        isClub: false,
                        isChapter: true
                    });
                } else {
                    members[existingMemberIndex].isChapter = true;
                }
            }

            const groupChatData: any = {
                chapter: existedChapter._id,
                club: existedChapter.club,
                name: existedChapter.name,
                profileImage: existedChapter.profileImage,
                members,
            }

            if (existedChapter.coverImage) {
                groupChatData.coverImage = existedChapter.coverImage;
            }

            const newGroupChat = new this.groupChatModel(groupChatData)

            await newGroupChat.save({ session });

            await session.commitTransaction();

            return {
                message: 'Chapter published',
                status: true
            }

        } catch (error) {
            console.log('error publishing/rejecting chapter', error);
            await session.abortTransaction();
            if (error instanceof NotFoundException) throw error;
            throw new Error('Error publishing/rejecting chapter');
        } finally {
            session.endSession();
        }
    }

    //----------------JOIN CHAPTER------------------

    /**
     * Join a chapter. If the user is an owner, admin, or moderator of the club,
     * they are automatically assigned the same role in the chapter. Otherwise,
     * they are assigned the member role.
     * @param userData - The user data containing the user id and role.
     * @param joinUserChapterDto - The request body containing the chapter id.
     * @returns A promise that resolves to an object with a message and status,
     * or an error object if there was an error.
     * @throws `NotFoundException` if the chapter is not found.
     * @throws `ConflictException` if the user is already a member of the chapter.
     * @throws `Error` if there was an error while trying to join the chapter.
         */
    async joinChapter(userData: any, joinUserChapterDto: JoinUserChapterDto) {
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const chapter = await this.chapterModel.findOne({
                _id: new Types.ObjectId(joinUserChapterDto.chapter),
                status: 'published'
            }).session(session);

            if (!chapter) {
                throw new NotFoundException('Chapter not found');
            }

            const existedMember = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(joinUserChapterDto.chapter),
                user: new Types.ObjectId(userData.userId)
            }).session(session);

            if (existedMember) {
                throw new ConflictException('You are already a member of this chapter');
            }

            const validRoles = ['admin', 'moderator', 'member'];
            const assignedRole = userData.userRole === 'owner' ? 'admin' : userData.userRole;

            if (!validRoles.includes(assignedRole)) {
                throw new Error('Invalid user role');
            }

            const chapterMemberData = new this.chapterMemberModel({
                chapter: new Types.ObjectId(joinUserChapterDto.chapter),
                user: new Types.ObjectId(userData.userId),
                role: assignedRole,
                status: 'MEMBER',
            })

            await chapterMemberData.save({ session });

            // if the role is admin add to chapter group chat
            if (assignedRole === 'admin') {
                const newUserId = new Types.ObjectId(userData.userId);
                const chapterId = new Types.ObjectId(joinUserChapterDto.chapter);

                // await this.groupChatModel.findOneAndUpdate(
                //     { chapter: chapterId },
                //     {
                //         $addToSet: {
                //             members: {
                //                 user: newUserId,
                //                 isClub: false,
                //                 isChapter: true
                //             }
                //         },
                //         // If member exists, update their isChapter field
                //         $set: {
                //             'members.$.isChapter': true
                //         }
                //     },
                //     {
                //         session,
                //         arrayFilters: [{ 'element.user': newUserId }]
                //     }
                // );
                await this.groupChatModel.findOneAndUpdate(
                    { chapter: chapterId },
                    {
                        $addToSet: {
                            members: {
                                user: newUserId,
                                isClub: false,
                                isChapter: true
                            }
                        }
                    },
                    { session }
                );
            }

            await session.commitTransaction();

            return {
                message: 'User joined chapter',
                status: true
            }

        } catch (error) {
            await session.abortTransaction();
            console.log('error joining chapter', error);
            if (error instanceof NotFoundException) throw error;
            if (error instanceof ConflictException) throw error;
            throw new Error('Error joining chapter');
        } finally {
            session.endSession();
        }
    }

    //----------------REMOVE USER FROM CHAPTER------------------

    /**
     * Remove a user from a chapter.
     * @param userId - The id of the user removing the user from the chapter.
     * @param removeUserChapterDto - The request body containing the chapter id and the user id of the user to remove from the chapter.
     * @returns A promise that resolves to an object with a message and status,
     * or an error object if there was an error.
     * @throws `NotFoundException` if the chapter is not found or if the user is not found.
     * @throws `ForbiddenException` if the user is a member of the chapter, or if the user is trying to remove a user with a higher role or with the same role.
     * @throws `Error` if there was an error while trying to remove the user from the chapter.
     */
    async removeUserFromChapter(userId: Types.ObjectId, removeUserChapterDto: RemoveUserChapterDto) {
        try {
            // check if user who is removing the user exists
            const userExists = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(removeUserChapterDto.chapter),
                user: new Types.ObjectId(userId),
            });

            if (!userExists) {
                throw new NotFoundException('you are not the member of this chapter');
            }

            // check if user to remove exists
            const userToRemoveExists = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(removeUserChapterDto.chapter),
                user: new Types.ObjectId(removeUserChapterDto.userToRemove)
            });

            if (!userToRemoveExists) {
                throw new NotFoundException('User to remove not the member of this chapter');
            }

            if (userExists.role === 'member') {
                throw new ForbiddenException('User can not remove an user with member role');
            }

            if ((userExists.role === 'admin' && userToRemoveExists.role === 'admin') ||
                (userExists.role === 'moderator' && userToRemoveExists.role === 'moderator') ||
                (userExists.role === 'moderator' && userToRemoveExists.role === 'admin')
            ) {
                throw new ForbiddenException('User can not remove an user with higher role or with same role');
            }


            await this.chapterMemberModel.deleteOne({
                chapter: removeUserChapterDto.chapter,
                user: removeUserChapterDto.userToRemove
            });

            return {
                message: 'User removed from chapter',
                status: true
            }

        } catch (error) {
            console.log('error removing user from chapter', error);
            if (error instanceof NotFoundException) throw error;
            throw new Error('Error removing user from chapter');
        }
    }

    //----------------DELETE CHAPTER------------------

    /**
     * Deletes a chapter.
     * @param deleteChapterDto The request body containing the chapter id.
     * @returns A promise that resolves to an object containing a message and status.
     * @throws {NotFoundException} If the chapter is not found.
     * @throws {ConflictException} If the chapter is already deleted.
     * @throws {Error} If there is an error while deleting the chapter.
     */
    async deleteChapter(deleteChapterDto: DeleteChapterDto) {
        try {
            const chapter = await this.chapterModel.findById(deleteChapterDto.chapter);

            if (!chapter) {
                throw new NotFoundException('Chapter not found');
            }

            if (chapter.isDeleted) {
                throw new ConflictException('Chapter is not found');
            }

            await this.chapterModel.findByIdAndUpdate(
                new Types.ObjectId(deleteChapterDto.chapter),
                { isDeleted: true },
                { new: true }
            );

            return {
                message: 'Chapter deleted',
                status: true
            };

        } catch (error) {
            console.error('Error deleting chapter:', error);
            if (error instanceof NotFoundException || error instanceof ConflictException) {
                throw error;
            }

            throw new Error('Error deleting chapter');
        }
    }


    async getChapter(chapterId: Types.ObjectId) {
        if (!chapterId) {
            throw new NotFoundException('Chapter id is required');
        }

        try {
            // First get the chapter with basic population
            let chapter: any = await this.chapterModel.findById(chapterId).populate([
                { path: 'node', select: 'name about profileImage coverImage' },
                { path: 'club', select: 'name about profileImage coverImage plugins' },
            ]).lean();

            if (!chapter) {
                throw new NotFoundException('Chapter not found');
            }

            // Get chapter members
            const chapterMembers = await this.chapterMemberModel.find({
                chapter: new Types.ObjectId(chapterId),
            }).populate('user', 'userName firstName lastName gender profileImage coverImage interests');

            // If there are no plugins, return early
            if (!chapter?.club?.plugins || chapter.club.plugins.length === 0) {
                return { chapter, chapterMembers };
            }

            // Process plugins similar to the node aggregation
            const clubWithPlugins = await this.clubModel.aggregate([
                {
                    $match: { _id: new mongoose.Types.ObjectId(chapter.club._id) }
                },
                {
                    $lookup: {
                        from: 'stdplugins', // Collection name for standard plugins
                        let: { plugins: '$plugins' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ['$_id', {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: '$$plugins',
                                                        cond: { $eq: ['$$this.type', 'standard'] }
                                                    }
                                                },
                                                in: { $toObjectId: '$$this.plugin' }
                                            }
                                        }]
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    name: 1,
                                    slug: 1,
                                    logo: 1,
                                    description: 1
                                }
                            }
                        ],
                        as: 'stdPluginDetails'
                    }
                },
                {
                    $addFields: {
                        plugins: {
                            $map: {
                                input: '$plugins',
                                as: 'plugin',
                                in: {
                                    $mergeObjects: [
                                        '$$plugin',
                                        {
                                            $cond: [
                                                { $eq: ['$$plugin.type', 'standard'] },
                                                {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: '$stdPluginDetails',
                                                                cond: { $eq: ['$$this._id', { $toObjectId: '$$plugin.plugin' }] }
                                                            }
                                                        },
                                                        0
                                                    ]
                                                },
                                                {}
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        stdPluginDetails: 0 // Remove the temporary field
                    }
                }
            ]).exec();

            // Update the chapter with the processed plugins
            if (clubWithPlugins.length > 0) {
                chapter.club = clubWithPlugins[0];
            }

            chapter.plugins = chapter.club.plugins;
            chapter.club.plugins = undefined;

            return { chapter, chapterMembers };

        } catch (error) {
            console.error('Error getting chapter:', error);

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new Error('Error getting chapter');
        }
    }
    /**
     * Removes a user from a chapter.
     * @param chapterUserData - An object containing the user's role and ID.
     * @param leaveUserChapterDto - An object containing the chapter id.
     * @returns A promise that resolves to an object containing a message and status.
     * @throws {Error} If there was an error while removing the user from the chapter.
     */
    async leaveUserFromChapter(chapterUserData: any, leaveUserChapterDto: LeaveUserChapterDto) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const chapterAdmins = await this.chapterMemberModel.find({
                chapter: new Types.ObjectId(leaveUserChapterDto.chapter),
                role: 'admin',
                user: { $ne: chapterUserData.userId }
            }).session(session);

            console.log("chapterAdmins", chapterAdmins);

            if (chapterUserData.userRole !== 'admin' || chapterAdmins.length > 1) {

                await this.chapterMemberModel.findOneAndDelete({
                    chapter: new Types.ObjectId(leaveUserChapterDto.chapter),
                    user: new Types.ObjectId(chapterUserData.userId)
                }).session(session);

                if (chapterUserData.userRole === 'admin') {
                    await this.removeFromGroupChat(leaveUserChapterDto.chapter, chapterUserData.userId, session);
                }

                await session.commitTransaction();

                return {
                    message: 'User left from chapter',
                    status: true
                }
            }

            let newChapterAdmin;

            newChapterAdmin = await this.chapterMemberModel
                .findOne({
                    role: 'moderator',
                    chapter: new Types.ObjectId(leaveUserChapterDto.chapter)
                })
                .sort({ createdAt: 1 })
                .session(session)
                .exec();

            if (!newChapterAdmin) {
                newChapterAdmin = await this.chapterMemberModel
                    .findOne({
                        role: 'member',
                        chapter: new Types.ObjectId(leaveUserChapterDto.chapter)
                    })
                    .sort({ createdAt: 1 })
                    .session(session)
                    .exec();
            }

            if (!newChapterAdmin) {
                throw new ForbiddenException("You can't leave the chapter");
            }

            await this.chapterMemberModel.findOneAndDelete({
                chapter: new Types.ObjectId(leaveUserChapterDto.chapter),
                user: new Types.ObjectId(chapterUserData.userId)
            }).session(session);

            newChapterAdmin.role = 'admin';
            await newChapterAdmin.save();

            // Remove original admin from group chat
            await this.removeFromGroupChat(leaveUserChapterDto.chapter, chapterUserData.userId, session);

            // Add new admin to group chat
            await this.addToGroupChat(leaveUserChapterDto.chapter, newChapterAdmin.user, session);

            await session.commitTransaction();

            return {
                message: 'User left from chapter',
                status: true
            }
        } catch (error) {
            console.log('error leaving user from chapter', error);
            await session.abortTransaction();
            if (error instanceof ForbiddenException) throw error;
            throw new Error('Error leaving user from chapter');
        } finally {
            await session.endSession();
        }
    }

    private async removeFromGroupChat(chapterId: Types.ObjectId, userId: string, session: ClientSession) {
        const member = await this.groupChatModel.findOne(
            {
                chapter: new Types.ObjectId(chapterId),
                'members.user': new Types.ObjectId(userId),
                'members.isChapter': true
            },
            { 'members.$': 1 }
        ).session(session);

        if (member?.members[0].isClub) {

            await this.groupChatModel.updateOne(
                {
                    chapter: new Types.ObjectId(chapterId),
                    'members.user': new Types.ObjectId(userId)
                },
                {
                    $set: { 'members.$.isChapter': false }
                }
            ).session(session);

        } else {

            await this.groupChatModel.updateOne(
                { chapter: new Types.ObjectId(chapterId) },
                {
                    $pull: {
                        members: {
                            user: new Types.ObjectId(userId),
                            isChapter: true
                        }
                    }
                }
            ).session(session);
        }

    }

    private async addToGroupChat(chapterId: Types.ObjectId, userId: Types.ObjectId, session: ClientSession) {
        const member = await this.groupChatModel.findOne(
            {
                chapter: new Types.ObjectId(chapterId),
                'members.user': userId,
                'members.isClub': true
            },
            { 'members.$': 1 }
        ).session(session);

        if (member?.members[0].isClub) {

            await this.groupChatModel.updateOne(
                {
                    chapter: new Types.ObjectId(chapterId),
                    'members.user': userId
                },
                {
                    $set: { 'members.$.isChapter': true }
                }
            ).session(session);

        } else {

            await this.groupChatModel.updateOne(
                { chapter: new Types.ObjectId(chapterId) },
                {
                    $push: {
                        members: {
                            user: userId,
                            isChapter: true,
                            isClub: false
                        }
                    }
                }
            ).session(session);
        }
    }

    //----------------GET CHAPTER MEMBER STATUS----------------

    /**
     * Retrieves the status of a user in a chapter.
     * @param userId The id of the user.
     * @param chapterId The id of the chapter.
     * @returns A promise that resolves to an object with the user's status and role in the chapter.
     * The status can be 'VISITOR', 'MEMBER', 'BLOCKED', or 'PENDING'.
     * The role can be null, 'owner', 'admin', 'moderator', or 'member'.
     * @throws {Error} If there was an error while retrieving the user's status.
     */
    async getChapterMemberStatus(userId: string, chapterId: string) {
        try {
            let status = 'VISITOR';

            const isMember = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(chapterId),
                user: new Types.ObjectId(userId)
            });

            if (isMember) {
                status = isMember.status;
                return { status, role: isMember.role };
            }

            return { status, role: null };
        } catch (error) {
            console.log('error getting chapter member status', error);
            throw new Error('Error getting chapter member status');
        }
    }

    //----------------UPVOTE PROPOSED CHAPTER----------------

    /**
     * Upvotes a proposed chapter. If the user has already upvoted the chapter, 
     * their upvote is removed. If the user has downvoted the chapter, the downvote 
     * is also removed upon upvoting.
     * 
     * @param chapterId - The ID of the chapter to upvote.
     * @param userId - The ID of the user performing the upvote.
     * @returns A promise that resolves to the updated chapter document.
     * @throws {NotFoundException} If the chapter ID is not provided or if no proposed chapter is found.
     * @throws {Error} If there is an error while upvoting the chapter.
     */
    async upvoteProposedChapter(chapterId: string, userId: string) {
        try {
            if (!chapterId) {
                throw new NotFoundException('Chapter id is required');
            }

            const existedChapter = await this.chapterModel.findOne({
                _id: new Types.ObjectId(chapterId),
                status: 'proposed'
            });

            if (!existedChapter) {
                throw new NotFoundException('No proposed chapter found');
            }

            const alreadyUpvote = existedChapter.upvotes.some((upvote) =>
                upvote.user.equals(new Types.ObjectId(userId))
            )

            if (alreadyUpvote) {
                return await this.chapterModel.findByIdAndUpdate(
                    new Types.ObjectId(chapterId),
                    { $pull: { upvotes: { user: new Types.ObjectId(userId) } } },
                    { new: true }
                )
            }

            return await this.chapterModel.findByIdAndUpdate(
                new Types.ObjectId(chapterId),
                {
                    $addToSet: { upvotes: { user: new Types.ObjectId(userId), date: new Date() } },
                    $pull: { downvotes: { user: new Types.ObjectId(userId) } }
                },
                { new: true }
            );

        } catch (error) {
            console.log('error upvoting chapter', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error upvoting chapter');
        }
    }

    //----------------DOWNVOTE PROPOSED CHAPTER----------------

    /**
     * Downvotes a proposed chapter. If the user has already downvoted the chapter,
     * their downvote is removed. If the user has upvoted the chapter, the upvote
     * is also removed upon downvoting.
     *
     * @param chapterId - The ID of the chapter to downvote.
     * @param userId - The ID of the user performing the downvote.
     * @returns A promise that resolves to the updated chapter document.
     * @throws {NotFoundException} If the chapter ID is not provided or if no proposed chapter is found.
     * @throws {Error} If there is an error while downvoting the chapter.
     */
    async downvoteProposedChapter(chapterId: string, userId: string) {
        try {

            if (!chapterId) {
                throw new NotFoundException('Chapter id is required');
            }

            const existedChapter = await this.chapterModel.findOne({
                _id: new Types.ObjectId(chapterId),
                status: 'proposed'
            });

            if (!existedChapter) {
                throw new NotFoundException('No proposed chapter found');
            }

            const alreadyDownvote = existedChapter.downvotes.some((downvote) =>
                downvote.user.equals(new Types.ObjectId(userId))
            )

            if (alreadyDownvote) {
                return await this.chapterModel.findByIdAndUpdate(
                    new Types.ObjectId(chapterId),
                    { $pull: { downvotes: { user: new Types.ObjectId(userId) } } },
                    { new: true }
                )
            }

            return await this.chapterModel.findByIdAndUpdate(
                new Types.ObjectId(chapterId),
                {
                    $addToSet: { downvotes: { user: new Types.ObjectId(userId), date: new Date() } },
                    $pull: { upvotes: { user: new Types.ObjectId(userId) } }
                },
                { new: true }
            )

        } catch (error) {
            console.log('error downvoting chapter', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error downvoting chapter');
        }
    }

    //----------------GET REJECTED CHAPTERS----------------

    /**
     * Retrieves all rejected chapters in a given node
     * @param nodeId The ID of the node to retrieve chapters from
     * @returns An array of rejected chapters in the node
     * @throws {NotFoundException} If the node ID is not provided
     * @throws {Error} If there is an error while retrieving chapters
     */
    async getRejectedChaptersOfNode(nodeId: Types.ObjectId) {
        try {

            if (!nodeId) {
                throw new NotFoundException('Node id is required');
            }

            const nodeRejectedChapters = await this.chapterModel
                .find({
                    node: nodeId,
                    status: 'rejected',
                    isDeleted: false,
                })
                .populate({
                    path: 'rejectedBy',
                    select: '-password -isBlocked -emailVerified -registered -signupThrough -isOnBoarded -onBoardingStage -__v'
                })

            return nodeRejectedChapters;

        } catch (error) {
            console.log('error getting rejected chapters of node', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error getting rejected chapters of node');
        }
    }

    async getChapterGroup(chapterId: string) {
        try {
            if (!chapterId) {
                throw new NotFoundException('Chapter id is required');
            }

            const existedChapter = await this.chapterModel.findById(new Types.ObjectId(chapterId))

            if (!existedChapter) {
                throw new NotFoundException('Chapter not found');
            }

            const existedChapterGroup = await this.groupChatModel.findOne({
                chapter: new Types.ObjectId(chapterId)
            }).populate({
                path: 'members.user',
                select: 'firstName lastName userName profileImage'
            });

            console.log(existedChapterGroup, 'chapter group')

            if (!existedChapterGroup) {
                throw new NotFoundException('Chapter group not found');
            }

            const messages = await this.chatMessageModel.find({
                group: existedChapterGroup._id
            }).populate('sender', 'userName firstName lastName middleName profileImage')

            return { group: existedChapterGroup, messages }

        } catch (error) {
            console.log('error getting chapter group', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error getting chapter group');
        }
    }

    async makeAdmin(roleAccessDto: RoleAccessDto) {
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const updatedChapterMember = await this.chapterMemberModel.findOneAndUpdate(
                {
                    chapter: new Types.ObjectId(roleAccessDto.chapter),
                    user: new Types.ObjectId(roleAccessDto.accessToUserId)
                },
                { $set: { role: 'admin' } },
                { new: true, session }
            )

            if (!updatedChapterMember) {
                throw new NotFoundException('User not found in chapter')
            }

            await this.addToGroupChat(new Types.ObjectId(roleAccessDto.chapter), new Types.ObjectId(roleAccessDto.accessToUserId), session)

            await session.commitTransaction();

            return updatedChapterMember;
        } catch (error) {
            console.log('error making admin', error);
            await session.abortTransaction();
            if (error instanceof NotFoundException) throw error
            throw new Error('Error making admin');
        } finally {
            await session.endSession();
        }
    }

    async makeModerator(roleAccessDto: RoleAccessDto) {
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const memberWhoIsGoingToChangeRole = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(roleAccessDto.chapter),
                user: new Types.ObjectId(roleAccessDto.accessToUserId)
            }).session(session);

            if (!memberWhoIsGoingToChangeRole) {
                throw new NotFoundException('User not found in chapter')
            }

            if (memberWhoIsGoingToChangeRole.role === 'admin') {
                await this.removeFromGroupChat(new Types.ObjectId(roleAccessDto.chapter), roleAccessDto.accessToUserId, session)
            }

            const updatedChapterMember = await this.chapterMemberModel.findOneAndUpdate(
                {
                    chapter: new Types.ObjectId(roleAccessDto.chapter),
                    user: new Types.ObjectId(roleAccessDto.accessToUserId)
                },
                { $set: { role: 'moderator' } },
                {
                    new: true,
                    session
                }
            )

            if (!updatedChapterMember) {
                throw new NotFoundException('User not found in chapter')
            }

            await session.commitTransaction();

            return updatedChapterMember;
        } catch (error) {
            await session.abortTransaction();
            console.log('error making moderator', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error making moderator');
        } finally {
            await session.endSession();
        }
    }

    async makeMember(roleAccessDto: RoleAccessDto) {
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
            const memberWhoIsGoingToChangeRole = await this.chapterMemberModel.findOne({
                chapter: new Types.ObjectId(roleAccessDto.chapter),
                user: new Types.ObjectId(roleAccessDto.accessToUserId)
            }).session(session);

            if (!memberWhoIsGoingToChangeRole) {
                throw new NotFoundException('User not found in chapter')
            }

            if (memberWhoIsGoingToChangeRole.role === 'admin') {
                await this.removeFromGroupChat(new Types.ObjectId(roleAccessDto.chapter), roleAccessDto.accessToUserId, session)
            }

            const updatedChapterMember = await this.chapterMemberModel.findOneAndUpdate(
                {
                    chapter: new Types.ObjectId(roleAccessDto.chapter),
                    user: new Types.ObjectId(roleAccessDto.accessToUserId)
                },
                { $set: { role: 'member' } },
                { new: true, session }
            )

            if (!updatedChapterMember) {
                throw new NotFoundException('User not found in chapter')
            }

            await session.commitTransaction();

            return updatedChapterMember;
        } catch (error) {
            await session.abortTransaction();
            console.log('error making member', error);
            if (error instanceof NotFoundException) throw error
            throw new Error('Error making member');
        } finally {
            await session.endSession();
        }
    }

    async addCustomName(name: string, chapterId: string) {
        console.log({ name });
        try {
            // Allow empty display names in the database, skip validation if empty.
            if (name !== undefined && !name.trim()) {
                // If the name is empty or just whitespace, update it directly
                const updatedChapter = await this.chapterModel.findByIdAndUpdate(
                    chapterId,
                    { $set: { displayName: "" } }, // Allow empty display name
                    { new: true }
                );

                if (!updatedChapter) {
                    throw new NotFoundException('Chapter not found');
                }

                return updatedChapter;
            }

            // Trim the name to remove leading/trailing whitespace
            const trimmedName = name.trim();

            // Escape special characters for regex pattern
            const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const namePattern = new RegExp(`^${escapedName}$`, 'i');

            // Check if a chapter already exists with this display name, excluding the current chapter
            const existingChapter = await this.chapterModel.findOne({
                displayName: namePattern,
                _id: { $ne: chapterId },
                isDeleted: false
            });
            console.log({ existingChapter })

            if (existingChapter) {
                throw new ConflictException('Display name already exists');
            }

            // Proceed with updating the chapter with the trimmed name
            const updatedChapter = await this.chapterModel.findByIdAndUpdate(
                chapterId,
                { $set: { displayName: trimmedName } },
                { new: true }
            );

            if (!updatedChapter) {
                throw new NotFoundException('Chapter not found');
            }

            return updatedChapter;

        } catch (error) {
            if (error instanceof ConflictException ||
                error instanceof NotFoundException ||
                error instanceof BadRequestException) {
                throw error;
            }

            console.error('Error updating chapter display name:', error);
            throw new InternalServerErrorException('Failed to update display name');
        }
    }



    async getChapterStatistics(chapterId: string) {
        try {
            const membersCount = await this.chapterMemberModel.find({ chapter: new Types.ObjectId(chapterId) }).countDocuments();
            return {
                membersCount
            }
        } catch (error) {
            throw error;
        }
    }

    async getBrandStories(chapterId: string) {
        try {
            const forumProfile = await this.forumProfileModel.findOne({
                chapter: new Types.ObjectId(chapterId),
            });
            return forumProfile?.brandStories || [];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageBrandStories(chapterId: string, body: any) {
        try {
            const { title, description, images, brandStoryId } = body;
            let { deletedFileUrl } = body;

            if (deletedFileUrl && !Array.isArray(deletedFileUrl)) {
                deletedFileUrl = [deletedFileUrl];
            }

            if (deletedFileUrl && deletedFileUrl.length > 0) {
                await this.deleteFiles(deletedFileUrl);
            }

            let uploadedImages = [];
            if (images && images.length > 0) {
                const uploadPromises = images.map((file) => this.uploadFile(file));
                uploadedImages = await Promise.all(uploadPromises);
            }

            let forumProfile = await this.forumProfileModel.findOne({
                chapter: new Types.ObjectId(chapterId),
            });

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create({
                    chapter: new Types.ObjectId(chapterId)
                });
            }

            if (brandStoryId) {
                // Update existing brand story
                const storyIndex = forumProfile.brandStories.findIndex(s => s._id.toString() === brandStoryId);

                if (storyIndex === -1) {
                    throw new NotFoundException('Brand story not found');
                }

                const existingStory = forumProfile.brandStories[storyIndex];
                let updatedImages = existingStory.images || [];

                // Remove deleted images from the array
                if (deletedFileUrl && deletedFileUrl.length > 0) {
                    updatedImages = updatedImages.filter(img => !deletedFileUrl.includes(img.url));
                }

                // Add new images
                if (uploadedImages.length > 0) {
                    updatedImages = [...updatedImages, ...uploadedImages];
                }

                // Check max 10 images
                if (updatedImages.length > 10) {
                    throw new BadRequestException('Maximum 10 images allowed');
                }

                forumProfile.brandStories[storyIndex].title = title;
                forumProfile.brandStories[storyIndex].description = description;
                forumProfile.brandStories[storyIndex].images = updatedImages;

                await forumProfile.save();
                return forumProfile.brandStories[storyIndex];
            } else {
                // Create new brand story
                const newStory = {
                    title,
                    description,
                    images: uploadedImages,
                };
                forumProfile.brandStories.push(newStory as any);
                await forumProfile.save();
                return forumProfile.brandStories[forumProfile.brandStories.length - 1];
            }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getHierarchy(chapterId: string) {
        try {
            const forumProfile = await this.forumProfileModel.findOne({
                chapter: new Types.ObjectId(chapterId),
            });
            return forumProfile?.hierarchy || null;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async manageHierarchy(chapterId: string, body: any) {
        try {
            const { file, deletedFileUrl } = body;

            let forumProfile = await this.forumProfileModel.findOne({
                chapter: new Types.ObjectId(chapterId),
            });

            if (!forumProfile) {
                forumProfile = await this.forumProfileModel.create({
                    chapter: new Types.ObjectId(chapterId),
                });
            }

            if (deletedFileUrl) {
                if (
                    forumProfile.hierarchy &&
                    forumProfile.hierarchy.url === deletedFileUrl
                ) {
                    await this.deleteFiles([deletedFileUrl]);
                    forumProfile.hierarchy = undefined;
                }
            }

            if (file) {
                if (forumProfile.hierarchy && forumProfile.hierarchy.url) {
                    await this.deleteFiles([forumProfile.hierarchy.url]);
                }
                const uploadResult = await this.uploadFile(file);
                forumProfile.hierarchy = {
                    url: uploadResult.url,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                };
            }

            await forumProfile.save();
            return forumProfile.hierarchy;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    private async deleteFiles(urls: string[]) {
        try {
            const deletePromises = urls?.map((url: string) =>
                this.uploadService.deleteFile(url)
            );
            const response = await Promise.all(deletePromises);
            return response;
        } catch (error) {
            console.log(error)
            throw new BadRequestException(
                'Failed to delete file. Please try again later.',
            );
        }
    }

    private async uploadFile(file: Express.Multer.File) {
        try {
            const response = await this.uploadService.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype,
                'chapter',
            );
            return {
                url: response.url,
                filename: response.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            };
        } catch (error) {
            throw new BadRequestException(
                'Failed to upload file. Please try again later.',
            );
        }
    }
}
