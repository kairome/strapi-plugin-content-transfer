import React, { useEffect, useMemo, useState } from 'react';
import _ from 'lodash';

import styled from 'styled-components';

import {
  Typography,
  Box,
  SingleSelectOption,
  SingleSelect,
  Combobox,
  ComboboxOption,
  TextInput,
  Checkbox,
  TextButton,
  Button,
  Loader,
} from '@strapi/design-system';
import { Collection, Entity } from 'types/data';
import PageContainer from '../../components/PageContainer';
import useApi from '../../utils/useApi';
import { fetchIntegrations, fetchCollections, fetchEntities, uploadEntities } from '../../api';
import Alert from '../../components/Alert';
import ErrorsList from './ErrorsList';
import Results from './Results';

const Entities = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  word-break: break-word;
`;

const EntitiesControlWrapper = styled.div`
  display: flex;
  align-items: baseline;
  gap: 20px;
  margin: 30px 0;
`;

const PageTitle = styled(Typography)`
  display: block;
  margin-bottom: 20px;
`;

const SelectsContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const EntitiesContainer = styled.div`
  margin: 20px 0;
`;

const TextWithMargin = styled.p`
  margin: 10px 0;
`;

const ActionContainer = styled(Box)`
  box-shadow: ${({ theme }) => theme.shadows.filterShadow};
  border-radius: 4px;
  padding: 15px 20px;
`;

const LoaderWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin: 10px 0;
`;

const HomePage = () => {
  const [action, setAction] = useState<'upload' | 'download'>('upload');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>();

  const {
    makeRequest: loadIntegrations,
    data: integrations,
    isLoading: integrationsLoading,
    isInitial: integrationsIsInitial,
  } = useApi(fetchIntegrations);

  const {
    makeRequest: loadEntities,
    data: collectionEntities,
    reset: resetEntities,
    isLoading: entitiesLoading,
    isInitial: entitiesIsInitial,
  } = useApi(fetchEntities);

  const {
    makeRequest: loadCollections,
    data: collections,
    isLoading: collectionsLoading,
    isInitial: collectionsIsInitial,
  } = useApi(fetchCollections);

  const [uploadAlert, setUploadAlert] = useState('');

  const {
    makeRequest: uploadEntitiesRequest,
    errors: uploadErrors,
    data: uploadResults,
    reset: resetUploadRequest,
    isLoading: uploadLoading,
  } = useApi(uploadEntities, {
    onSuccess: () => {
      setUploadAlert('success');
    },
    onError: () => {
      setUploadAlert('error');
    },
  });

  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  const [entitySearchText, setEntitySearchText] = useState('');

  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);

  const [createRelations, setCreateRelations] = useState(false);
  const [uploadMedia, setUploadMedia] = useState(false);
  const [transferLocales, setTransferLocales] = useState(false);

  const entities = useMemo(() => {
    if (!entitySearchText || !selectedCollection) {
      return collectionEntities;
    }

    const { mainField } = selectedCollection;

    return _.filter(collectionEntities, entity => _.includes(_.toLower(entity[mainField]), _.toLower(entitySearchText)));
  }, [entitySearchText, collectionEntities, selectedCollection]);

  useEffect(() => {
    loadCollections();
    loadIntegrations();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadEntities(selectedCollection.id);
    }
  }, [selectedCollection]);

  const handleCollectionChange = (value: string) => {
    const collection = _.find(collections, (collection) => collection.id === value);
    setSelectedCollection(collection ?? null);
    handleClearCollection();
  };

  const handleClearCollection = () => {
    resetEntities();
    resetUploadRequest();
    setSelectedEntities([]);
    setEntitySearchText('');
  };

  const handleEntitySearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEntitySearchText(event.target.value);
  };

  const handleCheckEntity = (entity: Entity) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;

    setSelectedEntities(checked ? [...selectedEntities, entity] : _.filter(selectedEntities, selected => selected.id !== entity.id));
  };

  const handleSelectAllEntities = () => {
    setSelectedEntities(entities ?? []);
  };

  const handleClearEntitySelection = () => {
    setSelectedEntities([]);
  };

  const renderOptions = () => _.map(collections, (collection) => {
    return (
      <ComboboxOption key={collection.id} value={collection.id}>{collection.name}</ComboboxOption>
    );
  });

  const renderEntities = () => {
    if (!selectedCollection) {
      return null;
    }

    if (entitiesLoading || entitiesIsInitial) {
      return (
        <LoaderWrapper>
          <Loader small />
        </LoaderWrapper>
      );
    }

    if (_.isEmpty(collectionEntities)) {
      return (
        <EntitiesContainer>
          <Typography textColor="danger500">There are no entities in the selected collection</Typography>
        </EntitiesContainer>
      );
    }

    const entityOptions = _.map(entities, (entity, index) => {
      const mainField = (entity as any)[selectedCollection.mainField] ?? null;
      const checked = Boolean(_.find(selectedEntities, e => e.id === entity.id));
      const key = `${mainField}-${index}` ?? `${selectedCollection.apiNameSingular}-${index}`;

      return (
        <Checkbox
          key={key}
          checked={checked}
          onChange={handleCheckEntity(entity)}
          disabled={uploadLoading}
        >
          {mainField ?? `${selectedCollection.name}-${entity.id}`}
        </Checkbox>
      );
    });

    return (
      <EntitiesContainer>
        <TextWithMargin>
          <Typography>
            Main field for collection {selectedCollection.name}: {selectedCollection.mainField}
          </Typography>
        </TextWithMargin>
        <TextInput
          label="Search by main field"
          value={entitySearchText}
          onChange={handleEntitySearchChange}
          disabled={uploadLoading}
        />
        <EntitiesControlWrapper>
          <TextButton
            onClick={handleSelectAllEntities}
            disabled={uploadLoading}
          >
            Select all found
          </TextButton>
          <TextButton variant="danger" onClick={handleClearEntitySelection} disabled={uploadLoading}>
            Clear all
          </TextButton>
        </EntitiesControlWrapper>
        <Entities>
          {entityOptions}
        </Entities>
      </EntitiesContainer>
    );
  };

  const handleAction = () => {
    if (!selectedCollection || !selectedIntegration) {
      return;
    }

    if (action === 'upload') {
      resetUploadRequest();
      uploadEntitiesRequest({
        collection: selectedCollection,
        entities: selectedEntities,
        createRelations,
        uploadMedia,
        transferLocales,
        integrationId: selectedIntegration,
      });
    }
  };

  const getSelectedIntegrationLabel = (val: string) => {
    const option = _.find(integrations, integration => String(integration.id) === val);
    return option ? option.name : 'Unknown option selected';
  };

  const renderErrors = () => {
    if (_.isEmpty(uploadErrors) || !selectedCollection) {
      return null;
    }

    return (
      <ErrorsList errors={uploadErrors} action={action} collectionName={selectedCollection.name} />
    );
  };

  const renderResults = () => {
    if (_.isEmpty(uploadResults) || !selectedCollection || uploadLoading) {
      return null;
    }


    const integration = _.find(integrations, integration => String(integration.id) === selectedIntegration);

    const integrationUrl = integration?.url ?? '';

    return (
      <Results
        results={uploadResults ?? []}
        action={action}
        integrationUrl={integrationUrl}
        mainField={selectedCollection.mainField}
        entityId={selectedCollection.id}
      />
    );
  };

  const renderActionBlock = () => {
    if (!selectedCollection || _.isEmpty(selectedEntities)) {
      return null;
    }

    if (uploadLoading) {
      return (
        <ActionContainer background="neutral0">
          <LoaderWrapper>
            <Loader />
          </LoaderWrapper>
        </ActionContainer>
      );
    }

    const actionDisabled = uploadLoading || !selectedIntegration;

    const actionName = action === 'download' ? 'Download' : 'Upload';

    return (
      <ActionContainer background="neutral0">
        <TextWithMargin>
          <Typography>
            {actionName} {selectedEntities.length} entities from collection {selectedCollection.name}
          </Typography>
        </TextWithMargin>
        <EntitiesControlWrapper>
          <Checkbox
            checked={uploadMedia}
            onChange={() => setUploadMedia(!uploadMedia)}
            disabled={uploadLoading}
          >
            Upload media
          </Checkbox>
          <Checkbox
            checked={createRelations}
            onChange={() => setCreateRelations(!createRelations)}
            disabled={uploadLoading}
          >
            Create relations
          </Checkbox>
          <Checkbox
            checked={transferLocales}
            onChange={() => setTransferLocales(!transferLocales)}
            disabled={uploadLoading}
          >
            Transfer locales
          </Checkbox>
        </EntitiesControlWrapper>
        <SingleSelect
          aria-label="integration"
          label="Select integration"
          onChange={setSelectedIntegration}
          value={selectedIntegration}
          customizeContent={getSelectedIntegrationLabel}
          disabled={uploadLoading}
          required
        >
          {_.map(integrations, integration => (
            <SingleSelectOption value={integration.id} key={integration.id}>
              {integration.name}
              <br />
              <Typography variant="pi">
                {integration.url}
              </Typography>
            </SingleSelectOption>
          ))}
        </SingleSelect>
        <br />
        {renderErrors()}
        {renderResults()}
        <Button disabled={actionDisabled} onClick={handleAction}>
          {actionName}
        </Button>
      </ActionContainer>
    );
  };

  const renderContent = () => {
    if (collectionsLoading || integrationsLoading || collectionsIsInitial || integrationsIsInitial) {
      return (
        <LoaderWrapper>
          <Loader />
        </LoaderWrapper>
      );
    }

    return (
      <>
        <SelectsContainer>
          <SingleSelect
            aria-label="Action"
            label="Select action"
            onChange={setAction}
            value={action}
            disabled
          >
            <SingleSelectOption value="upload">
              Upload
            </SingleSelectOption>
            <SingleSelectOption value="download">
              Download
            </SingleSelectOption>
          </SingleSelect>
          <Combobox
            label="Select collection"
            autoComplete="off"
            value={selectedCollection?.id}
            onChange={handleCollectionChange}
            onClear={handleClearCollection}
            disabled={uploadLoading}
          >
            {renderOptions()}
          </Combobox>
        </SelectsContainer>
        {renderEntities()}
        {renderActionBlock()}
      </>
    );
  };

  return (
    <PageContainer>
      <PageTitle variant="alpha">Content transfer</PageTitle>
      <Alert
        show={uploadAlert === 'success'}
        onClose={() => setUploadAlert('')}
        title="Entities uploaded!"
        variant="success"
      />
      <Alert
        show={uploadAlert === 'error'}
        onClose={() => setUploadAlert('')}
        title="Errors uploading entities"
        variant="danger"
      />
      {renderContent()}
    </PageContainer>
  );
};

export default HomePage;
