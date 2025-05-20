import type { Common } from '@strapi/types/dist/types';

export interface Collection {
  apiNamePlural: string,
  apiNameSingular: string,
  id: Common.UID.ContentType,
  mainField: string,
  name: string,
}

export interface Entity extends Record<string, any> {
  id: number,
  localizations?: Entity[],
  locale: string,
}

export interface ApiEntityAttributes extends Record<string, any> {
  locale: string,
  localizations: {
    data: ApiEntity[],
  }
}

export interface ApiEntity {
  id: number,
  attributes: ApiEntityAttributes,
}

export interface ApiEntitiesResponse {
  data: ApiEntity[],
  meta: {
    pagination: {
      start: number,
      limit: number,
      total: number,
    }
  }
}

export interface RelationFields {
  dynamicZone: boolean,
  repeatable: boolean,
  type: string,
  uid: Common.UID.ContentType,
  [k: string]: unknown,
}

export type RelationValues = {
  [k: string]: Entity,
};

export type PopulateSchema = {
  [k: string]: PopulateSchema | boolean | undefined,
  on?: PopulateSchema,
  populate?: PopulateSchema,
};

export interface MediaFile {
  id: number,
  name: string,
  width: number,
  height: number,
  hash: string,
  mime: string,
  size: number,
  url: string,
  provider: string,
}

export interface CollectionSettingsValue {
  mainField: string,
  bulkable: boolean,
  filterable: boolean,
  searchable: boolean,
  pageSize: number,
}

export interface CollectionSettings {
  uid: Common.UID.ContentType,
  settings: CollectionSettingsValue,
}

export interface ErrorDetailItem {
  message: string,
  name: string,
}

export interface ErrorItem {
  message: string,
  field?: string,
  details?: ErrorDetailItem[],
}

export interface Integration {
  id: number,
  name: string,
  url: string,
}

export interface IntegrationEntity extends Integration {
  token: string,
}

export interface GenericUtilResponse<T = Entity> {
  data: T | null,
  errors: ErrorItem[],
}

export interface RemoteLocaleInfo {
  id: number,
  name: string,
  code: string,
  isDefault: boolean,
}

export interface LocalesInfo {
  localDefaultLocale: string,
  remoteDefaultLocale: string,
  availableRemoteLocales: string[],
}