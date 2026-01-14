import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Node_ } from "./node.entity";
import { Club } from "./club.entity";
import { Chapter } from "./chapters/chapter.entity";

@Schema({ timestamps: true })
export class ForumProfile {
    @Prop({ type: Types.ObjectId, ref: Node_.name, required: false })
    node: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Club.name, required: false })
    club: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Chapter.name, required: false })
    chapter: Types.ObjectId;

    @Prop({
        type: {
            headerImages: [
                {
                    url: String,
                    originalname: String,
                    mimetype: String,
                    size: Number,
                },
            ],
            usp: { type: String, max: 300 },
            website: { type: String },
            specialization: { type: String, max: 300 },
            challenges: { type: String, max: 500 },
            testimonials: [
                {
                    name: String,
                    designation: String,
                    description: String,
                    rating: Number,
                    image: String,
                },
            ],
            targetDomains: [String],
            attachments: [
                {
                    uuid: String,
                    url: String,
                    originalname: String,
                    mimetype: String,
                    size: Number,
                    title: String,
                    type: { type: String, enum: ['file', 'folder'], default: 'file' },
                    parentId: { type: String, default: null },
                },
            ],
            showcase: [
                {
                    title: String,
                    description: String,
                    images: [String],
                    type: { type: String, enum: ['attachment', 'works', 'csr', 'sustainability', 'others'], default: 'others' },
                },
            ],
            ourClients: [
                {
                    name: String,
                    logo: String,
                },
            ],
        },
        default: { headerImages: [], usp: '', website: '', specialization: '', challenges: '', testimonials: [], targetDomains: [], attachments: [], showcase: [], ourClients: [] },
    })
    about: {
        headerImages: {
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
        }[];
        usp?: string;
        website?: string;
        specialization?: string;
        challenges?: string;
        testimonials?: {
            name: string;
            designation: string;
            description: string;
            rating: number;
            image?: string;
        }[];
        targetDomains?: string[];
        attachments?: {
            uuid?: string;
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
            title?: string;
            type?: 'file' | 'folder';
            parentId?: string | null;
        }[];
        showcase?: {
            title: string;
            description: string;
            images: string[];
            type?: 'attachment' | 'works' | 'csr' | 'sustainability' | 'others';
        }[];
        ourClients?: {
            name: string;
            logo?: string;
        }[];
    };

    @Prop({
        type: [
            {
                name: { type: String, required: true },
                email: { type: String, required: true },
                address: { type: String, required: true },
                phoneNumber: { type: String, required: false },
                customerNumber: { type: String, required: false },
                complaintNumber: { type: String, required: false },
                isMainBranch: { type: Boolean, default: false },
                googleMapLink: { type: String, required: false },
            },
        ],
        default: [],
    })
    branches: {
        name: string;
        email: string;
        address: string;
        phoneNumber?: string;
        customerNumber?: string;
        complaintNumber?: string;
        isMainBranch?: boolean;
        googleMapLink?: string;
    }[];

    @Prop({
        type: [
            {
                name: {
                    type: String,
                    required: true,
                },
                link: { type: String },
                title: { type: String, required: false },
            }
        ],
        default: [],
    })
    socialLinks: {
        name: string;
        link: string;
        title?: string;
    }[];

    @Prop({
        type: [
            {
                title: { type: String, required: true, max: 75 },
                description: { type: String, required: true, max: 750 },
                members: [
                    {
                        name: { type: String, required: true },
                        designation: { type: String, required: true },
                        contactDetails: {
                            type: String,
                            required: true,
                            max: 750,
                        },
                    },
                ],
                files: [
                    {
                        url: String,
                        originalname: String,
                        mimetype: String,
                        size: Number,
                    },
                ],
                events: [
                    {
                        title: { type: String, required: true, max: 100 },
                        date: { type: Date, required: true },
                        images: [
                            {
                                url: String,
                                originalname: String,
                                mimetype: String,
                                size: Number,
                            },
                        ],
                    },
                ],
            },
        ],
        default: [],
    })
    committee: {
        title: string;
        description: string;
        members: {
            name: string;
            designation: string;
            contactDetails: string;
        }[];
        files: {
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
        }[];
        events?: {
            title: string;
            date: Date;
            images: {
                url?: string;
                originalname?: string;
                mimetype?: string;
                size?: number;
            }[];
        }[];
    }[];

    @Prop({
        type: [
            {
                title: { type: String, required: true },
                description: { type: String, required: true },
                images: [
                    {
                        url: String,
                        originalname: String,
                        mimetype: String,
                        size: Number,
                        filename: String,
                    },
                ],
            },
        ],
        default: [],
    })
    brandStories: {
        _id?: string;
        title: string;
        description: string;
        images: {
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
            filename?: string;
        }[];
    }[];

    @Prop({
        type: [
            {
                title: { type: String, required: true },
                description: { type: String, required: true },
                file: {
                    url: String,
                    originalname: String,
                    mimetype: String,
                    size: Number,
                    filename: String,
                },
            },
        ],
        default: [],
    })
    productComparisons: {
        _id?: string;
        title: string;
        description: string;
        file: {
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
            filename?: string;
        };
    }[];

    @Prop({
        type: [
            {
                name: { type: String, required: true },
                title: { type: String, required: true },
                description: { type: String, required: false },
                image: {
                    url: String,
                    originalname: String,
                    mimetype: String,
                    size: Number,
                },
                socialLinks: [
                    {
                        platform: { type: String, required: true },
                        url: { type: String, required: true },
                    },
                ],
            },
        ],
        default: [],
    })
    managementTeam: {
        _id?: string;
        name: string;
        title: string;
        description?: string;
        image?: {
            url?: string;
            originalname?: string;
            mimetype?: string;
            size?: number;
        };
        socialLinks?: {
            platform: string;
            url: string;
        }[];
    }[];

    @Prop({
        type: {
            url: String,
            originalname: String,
            mimetype: String,
            size: Number,
        },
        required: false
    })
    hierarchy?: {
        url?: string;
        originalname?: string;
        mimetype?: string;
        size?: number;
    };

    @Prop({
        type: [
            {
                type: { type: String, required: true, maxlength: 50 },
                contactDetails: { type: String, required: false, maxlength: 75 },
                description: { type: String, required: true, maxlength: 500 },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    makeItBetter: {
        _id?: string;
        type: string;
        contactDetails?: string;
        description: string;
        createdAt?: Date;
    }[];
}

export const ForumProfileSchema = SchemaFactory.createForClass(ForumProfile);
