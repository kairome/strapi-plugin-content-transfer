import { ApiEntity, Collection, Entity, ErrorItem, IntegrationEntity, MediaFile, RelationFields } from './data';
import { RemoteStrapiClient } from '../server/utils/request';
import type { Common } from '@strapi/types/dist/types';

export interface UploadEntitiesPayload {
  collection: Collection,
  entities: Entity[],
  createRelations: boolean,
  uploadMedia: boolean,
  transferLocales: boolean,
  integrationId: string,
}

export interface UploadMediaPayload {
  apiClient: RemoteStrapiClient,
  mediaFiles: MediaFile[],
  uploadMedia: boolean,
}

export interface CreateEntitiesPayload {
  entities: Entity[],
  collectionMainField: string,
  apiClient: RemoteStrapiClient,
  collectionApiName: string,
  relationFields: RelationFields,
  newRelations: (Entity & { oldId: number, modelId: string })[],
  newMediaFiles: MediaFile[],
  transferLocales: boolean,
}

export interface CreateRelationsPayload {
  relations: Record<Common.UID.ContentType, Entity[]>,
  apiClient: RemoteStrapiClient,
  createMissingRelations: boolean,
  transferLocales: boolean,
}

export interface ControllerResponse<TData> {
  data: TData,
  errors: ErrorItem[],
}

export type AddIntegrationPayload = Omit<IntegrationEntity, 'id'>;

export interface EditIntegrationPayload {
  id: number,
  name: string,
}

interface EntityCrudPayload {
  collectionApiClient: RemoteStrapiClient,
  modelId: string,
  entity: Entity,
  createMissingRelations: boolean,
  mainField: string,
}

export interface CreateEntityPayload extends EntityCrudPayload {
  otherLocaleIds: number[],
}

export interface UpdateEntityPayload extends EntityCrudPayload {
  remoteEntityId: number,
}

export interface CreateEntityLocalizationPayload extends CreateEntityPayload {
  parentId: number,
}

export interface CreateParentRelationPayload {
  collectionApiClient: RemoteStrapiClient,
  modelId: string,
  currentRelation: Entity,
  mainField: string,
  createMissingRelations: boolean,
  remoteLocalizations: ApiEntity[],
  localLocalizations: Entity[],
}

export interface GetCreateLocalizationParentPayload extends CreateParentRelationPayload {
  existingParent: Entity | undefined,
}

export interface EntityLocalizationsPayload {
  parentId: number,
  localizations: Entity[],
  collectionApiClient: RemoteStrapiClient,
  collectionMainField: string,
}