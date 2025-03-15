export default [
  {
    method: 'GET',
    path: '/collections',
    handler: 'entitiesController.getCollections',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/collections/:collectionId/entities',
    handler: 'entitiesController.getEntitiesByCollection',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/entities/upload',
    handler: 'entitiesController.uploadEntities',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/integrations',
    handler: 'integrationsController.getIntegrations',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/integrations',
    handler: 'integrationsController.createIntegration',
    config: {
      policies: [],
    },
  },
  {
    method: 'PUT',
    path: '/integrations/:integrationId',
    handler: 'integrationsController.updateIntegration',
    config: {
      policies: [],
    },
  },
  {
    method: 'DELETE',
    path: '/integrations/:integrationId',
    handler: 'integrationsController.deleteIntegration',
    config: {
      policies: [],
    },
  },
];
