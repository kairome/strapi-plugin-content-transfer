import { CreateEntityLocalizationPayload, CreateEntityPayload, UpdateEntityPayload } from '../../../types/payloads';
import { GenericUtilResponse } from '../../../types/data';
import { getErrorDetails } from '../../utils/data';

export const updateEntity = async (payload: UpdateEntityPayload): Promise<GenericUtilResponse> => {
  const {
    createMissingRelations,
    modelId,
    entity,
    mainField,
    collectionApiClient,
    remoteEntityId,
  } = payload;

  if (!createMissingRelations) {
    return {
      data: null,
      errors: [],
    };
  }

  try {
    const { data: updatedEntity } = await collectionApiClient.update(`/${remoteEntityId}`, { data: { ...entity, id: undefined }});
    return {
      data: {
        ...updatedEntity.data.attributes,
        modelId,
        id: updatedEntity.data.id,
        oldId: entity.id,
      },
      errors: [],
    };
  } catch (err) {
    return {
      data: null,
      errors: [{
        message: `Failed to update ${modelId} entity ${entity[mainField]} (${entity.locale})`,
        details: getErrorDetails(err),
      }]
    };
  }
};

export const createEntity = async (payload: CreateEntityPayload) => {
  const {
    createMissingRelations,
    modelId,
    entity,
    mainField,
    collectionApiClient,
    otherLocaleIds,
  } = payload;

  if (!createMissingRelations) {
    return {
      data: null,
      errors: [],
    };
  }

  try {
    const { data: newEntity } = await collectionApiClient.create('', {
      data: {
        ...entity,
        id: undefined,
        localizations: otherLocaleIds,
      },
    });

    return {
      data: {
        ...newEntity.data.attributes,
        modelId,
        id: newEntity.data.id,
        oldId: entity.id,
      },
      errors: [],
    };
  } catch (err) {
    return {
      data: null,
      errors: [{
        message: `Failed to create ${modelId} entity ${entity[mainField]} (${entity.locale})`,
        details: getErrorDetails(err),
      }],
    };
  }
};

export const createEntityLocalization = async (payload: CreateEntityLocalizationPayload): Promise<GenericUtilResponse> => {
  const {
    createMissingRelations,
    modelId,
    entity,
    mainField,
    collectionApiClient,
    parentId,
    otherLocaleIds,
  } = payload;

  if (!createMissingRelations) {
    return {
      data: null,
      errors: [],
    };
  }

  if (!parentId) {
    return {
      data: null,
      errors: [{
        message: `Failed to create localized entity ${entity[mainField]}: Parent id cannot be empty`,
      }],
    };
  }

  try {
    const { data: newLocalization } = await collectionApiClient.create(`/${parentId}/localizations`, {
      ...entity,
      id: undefined,
      localizations: otherLocaleIds,
    });

    return {
      data: {
        ...newLocalization,
        modelId,
        id: newLocalization.id,
        oldId: entity.id,
      },
      errors: [],
    };
  } catch (err) {
    return {
      data: null,
      errors: [
        {
          message: `Failed to create localized entity ${modelId} for ${entity[mainField]} with locale ${entity.locale}`,
          details: getErrorDetails(err),
        }
      ],
    };
  }
};