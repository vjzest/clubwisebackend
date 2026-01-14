import { Chapter } from '../shared/entities/chapters/chapter.entity';
import { Club } from '../shared/entities/club.entity';
import { Debate } from '../shared/entities/debate/debate.entity';
import { DebateAdoption } from '../shared/entities/debate/debate-adoption-entity';
import { IssuesAdoption } from '../shared/entities/issues/issues-adoption.entity';
import { Issues } from '../shared/entities/issues/issues.entity';
import { Node_ } from '../shared/entities/node.entity';
import { ProjectAdoption } from '../shared/entities/projects/project-adoption.entity';
import { Projects } from '../shared/entities/projects/project.entity';
import { RulesAdoption } from '../shared/entities/rules/rules-adoption.entity';
import { RulesRegulations } from '../shared/entities/rules/rules-regulations.entity';
import { StdAssetAdoption } from '../shared/entities/standard-plugin/std-asset-adoption.entity';
import { StdPluginAsset } from '../shared/entities/standard-plugin/std-plugin-asset.entity';
import { GenericPost } from '../shared/entities/generic-post.entity';

export const printWithBorder = (message: string) => {
  const border = '='.repeat(message.length + 4);
  console.log(`\n${border}`);
  console.log(`| ${message} |`);
  console.log(`${border}\n`);
};

export const FORUM_TYPE_MAP = new Map([
  ['Club', Club.name],
  ['Node', Node_.name],
  ['Chapter', Chapter.name],
]);

export const MODULE_TYPE_MAP = new Map([
  ['Projects', Projects.name],
  ['Issues', Issues.name],
  ['Debate', Debate.name],
  ['RulesRegulations', RulesRegulations.name],
  ['StdPluginAsset', StdPluginAsset.name],
  ['Generic', GenericPost.name],
]);

export const ASSET_ADOPTION_TYPE_MAP = new Map([
  ['RulesRegulationsAdoption', RulesAdoption.name],
  ['IssuesAdoption', IssuesAdoption.name],
  ['ProjectAdoption', ProjectAdoption.name],
  ['DebateAdoption', DebateAdoption.name],
  ['StdAssetAdoption', StdAssetAdoption.name],
]);