import { Types } from 'mongoose';
import { Debate } from './debate.entity';
import { DebateArgument } from './debateArgument.entity';
import { Node_ } from 'src/shared/entities/node.entity';
import { Club } from 'src/shared/entities/club.entity';

interface DebateWithArguments extends Omit<Debate, 'arguments'> {
  args: {
    for: DebateArgument[];
    against: DebateArgument[];
  };
}

interface DebatesResponse {
  message: string;
  data: DebateWithArguments[];
  pagination?: {
    currentPage: number
    totalPages: number,
    totalItems: number,
  }
}

type TPublishedStatus =
  | 'proposed'
  | 'published'
  | 'draft'
  | 'archived'
  | 'rejected';

enum EPublishedStatus {
  PROPOSED = 'proposed',
  PUBLISHED = 'published',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

interface TFileObject {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

type TForum = "node" | "club" | "chapter"
interface FileUploadResponse {
  url: string;
  mimeType: string;
  filename: string;
}

type TPlugins = "rules" | "issues" | "debate" | "projects";
type TNotification = 'invite' | 'join-request' | 'join-approved' | 'join-rejected'

plugins: [
  {
    plugin: TPlugins,
    entityId: Types.ObjectId,
    entityType: typeof Node_.name | typeof Club.name,
    addedDate: Date
  }
]

type TIssueActionType =
  | "publish"
  | "reject"
  | "inactivate"
  | "resolved"
  | "unresolved"
  | "removeadoption"
  | "archive"
  | "unarchive";


type TCreationType = "adopted" | "original";


interface IRelevantAndView {
  user: Types.ObjectId;
  date: Date;
}

interface IAdoptedClub {
  club: Types.ObjectId;
  date: Date;
}

interface IAdoptedNode {
  node: Types.ObjectId;
  date: Date;
}

