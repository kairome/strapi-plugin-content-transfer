import {
  CreateParentRelationPayload,
  GetCreateLocalizationParentPayload,
} from '../../../types/payloads';
import { getConnectedLocalizations } from '../../utils/data';
import * as _ from 'lodash';
import { ApiEntitiesResponse, GenericUtilResponse } from '../../../types/data';
import { createEntity, createEntityLocalization, updateEntity } from './entities';

export const createParentRelation = async (payload: CreateParentRelationPayload): Promise<GenericUtilResponse> => {
  const {
    collectionApiClient,
    createMissingRelations,
    currentRelation,
    remoteLocalizations,
    localLocalizations,
    modelId,
    mainField,
  } = payload;

  // find connected remote localizations from local translations
  const { localizations, mainLocaleParent } = getConnectedLocalizations(remoteLocalizations, localLocalizations, mainField, currentRelation.locale);

// if localizations have the default locale entity, it means the main field has changed and we need to update the existing remote entity
  if (mainLocaleParent) {
    return await updateEntity({
      createMissingRelations,
      modelId,
      entity: currentRelation,
      mainField,
      collectionApiClient,
      remoteEntityId: mainLocaleParent.id,
    });
  }


  // connect existing localizations to the new parent
  if (!mainLocaleParent && !_.isEmpty(localizations)) {
    return await createEntityLocalization({
      createMissingRelations,
      modelId,
      entity: currentRelation,
      mainField,
      collectionApiClient,
      parentId: localizations[0],
      otherLocaleIds: localizations,
    });
  }

  return await createEntity({
    createMissingRelations,
    modelId,
    entity: currentRelation,
    mainField,
    collectionApiClient,
    otherLocaleIds: [],
  })
};

export const getCreateLocaleParent = async (data: GetCreateLocalizationParentPayload): Promise<GenericUtilResponse> => {
  const {
    collectionApiClient,
    currentRelation,
    mainField,
    createMissingRelations,
    modelId,
    remoteLocalizations,
    localLocalizations,
    existingParent,
  } = data;

  if (existingParent) {
    return {
      data: existingParent,
      errors: [],
    };
  }

  const parentQueries = `filters[${mainField}][$eq]=${currentRelation[mainField]}&locale=${currentRelation.locale}&publicationState=preview`;
  const { data: remoteParentResp } = await collectionApiClient.fetch<ApiEntitiesResponse>(`/?${parentQueries}`);
  const remoteParent = remoteParentResp ? remoteParentResp[0] : null;

  if (remoteParent) {
    return {
      data: {
        ...remoteParent.attributes,
        id: remoteParent.id,
        localizations: remoteParent.attributes?.localizations?.data as any,
      },
      errors: [],
    };
  }

  const { data: newParent, errors: newParentErrors } = await createParentRelation({
    collectionApiClient,
    currentRelation,
    remoteLocalizations,
    localLocalizations,
    mainField,
    createMissingRelations,
    modelId,
  });

  return {
    data: newParent,
    errors: newParentErrors,
  };
};