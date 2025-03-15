import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchIntegrations,
  addIntegration,
  editIntegration,
  deleteIntegration,
} from '../../api';
import {
  Typography,
  Loader,
  Button,
  ModalLayout,
  ModalBody,
  ModalHeader,
  ModalFooter,
  TextInput,
  Textarea,
  Box,
} from '@strapi/design-system';
import PageContainer from '../../components/PageContainer';
import Alert from '../../components/Alert';
import useApi from '../../utils/useApi';
import styled from 'styled-components';
import _ from 'lodash';
import { Integration } from 'types/data';

const PageTitle = styled(Typography)`
  display: block;
`;

const LoaderContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
`;

const NewIntegrationForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const IntegrationsList = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
`;

const IntegrationBox = styled(Box)`
  box-shadow: ${({ theme }) => theme.shadows.filterShadow};
  border-radius: 4px;
  padding: 15px 20px;
`;

const IntegrationItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const RequestError = styled(Typography)`
  display: block;
  margin-top: 15px;
`;

const defaultErrors = {
  name: undefined,
  url: undefined,
  token: undefined,
};

const defaultIntegration = {
  name: '',
  url: '',
  token: '',
};

type IntegrationState = Omit<Integration, 'id'> & {
  id?: number,
  token: string,
};

const IntegrationsPage = () => {
  const { data, isLoading, makeRequest, isInitial, updateData } = useApi(fetchIntegrations);
  const [successAlert, setSuccessAlert] = useState('');

  const {
    isLoading: addIntegrationLoading,
    makeRequest: addIntegrationRequest,
    errors: addErrors,
    reset: resetAddRequest,
  } = useApi(addIntegration, {
    onSuccess: (addedIntegration) => {
      updateData((prevData) => prevData ? [...prevData, addedIntegration] : [addedIntegration]);
      setShowAddModal(false);
      setSuccessAlert('added');
    },
  });

  const {
    isLoading: editLoading,
    makeRequest: editIntegrationRequest,
    errors: editErrors,
    reset: resetEditRequest,
  } = useApi(editIntegration, {
    onSuccess: (editedIntegration) => {
      updateData((prevData) => _.map(prevData, item => item.id === editedIntegration.id ? editedIntegration : item));
      setShowAddModal(false);
      setSuccessAlert('edited');
    },
  });

  const {
    isLoading: deleteLoading,
    makeRequest: deleteIntegrationRequest,
  } = useApi(deleteIntegration, {
    onSuccess: (deletedId) => {
      updateData(prevData => _.filter(prevData, item => item.id !== deletedId));
      setSuccessAlert('deleted');
    },
  });

  const [showAddModal, setShowAddModal] = useState(false);

  const [currentIntegration, setCurrentIntegration] = useState<IntegrationState>(defaultIntegration);

  const [integrationFormErrors, setIntegrationFormErrors] = useState<Partial<typeof currentIntegration>>(defaultErrors);

  const formLoading = useMemo(() => addIntegrationLoading || editLoading || deleteLoading, [addIntegrationLoading, editLoading, deleteLoading]);

  useEffect(() => {
    makeRequest();
  }, []);

  useEffect(() => {
    if (!showAddModal) {
      setCurrentIntegration(defaultIntegration);
      setIntegrationFormErrors(defaultErrors);
      resetAddRequest();
      resetEditRequest();
    }
  }, [showAddModal]);

  const validateFields = () => {
    const { name, url, token } = currentIntegration;
    const errors = { ...integrationFormErrors };

    if (!name) {
      errors.name = 'This field cannot be empty';
    }

    if (currentIntegration.id) {
      setIntegrationFormErrors(errors);
      return _.every(errors, e => _.isEmpty(e));
    }

    if (!url) {
      errors.url = 'This field cannot be empty';
    }

    if (url) {
      if (/http(s)?:\/\/localhost/.test(url)) {
        errors.url = 'Replace localhost with 0.0.0.0';
      }

      const urlObj = new URL(url);
      if (urlObj.origin !== url) {
        errors.url = 'The url must not contain extra paths';
      }
    }

    if (!token) {
      errors.token = 'This field cannot be empty';
    }

    setIntegrationFormErrors(errors);
    return _.every(errors, e => _.isEmpty(e));
  };

  const handleAddIntegrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsValid = validateFields();
    if (!fieldsValid) {
      return;
    }

    if (currentIntegration.id) {
      editIntegrationRequest({ name: currentIntegration.name, id: currentIntegration.id });
      return;
    }

    addIntegrationRequest(currentIntegration);
  };

  const handleFieldChange = (fieldKey: Exclude<keyof IntegrationState, 'id'>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVals = { ...currentIntegration };
    newVals[fieldKey] = e.target.value;

    setIntegrationFormErrors(defaultErrors);
    setCurrentIntegration(newVals);
  };

  const handleEditIntegration = (integration: Integration) => {
    setCurrentIntegration({ ...integration, token: '' });
    setShowAddModal(true);
  };

  const handleDeleteIntegration = (integration: Integration) => {
    deleteIntegrationRequest(integration.id);
  };

  const getAlertTitle = () => {
    if (successAlert === 'added') {
      return 'Integration added!';
    }

    if (successAlert === 'edited') {
      return 'Integration edited!';
    }

    if (successAlert === 'deleted') {
      return 'Integration deleted!';
    }

    return '';
  };

  const renderIntegrations = () => {
    if (isLoading || isInitial) {
      return (
        <LoaderContainer>
          <Loader />
        </LoaderContainer>
      );
    }

    if (_.isEmpty(data)) {
      return (
        <div>
          <Typography>
            There are no integrations yet.
          </Typography>
        </div>
      );
    }

    const integrationsList = _.map(data, (item, index) => {
      if (!item) {
        return null;
      }
      return (
        <IntegrationBox key={item.id} background="neutral0">
          <IntegrationItemHeader>
            <Typography variant="beta">
              {item.name}
            </Typography>
            <Button variant="secondary" onClick={() => handleEditIntegration(item)}>
              Edit
            </Button>
          </IntegrationItemHeader>
          <Typography>
            {item.url}
          </Typography>
          <br />
          <br />
          <Button variant="danger-light" disabled={deleteLoading} onClick={() => handleDeleteIntegration(item)}>
            Delete
          </Button>
        </IntegrationBox>
      );
    });
    return (
      <IntegrationsList>
        {integrationsList}
      </IntegrationsList>
    );
  };

  const renderRequestErrors = () => {
    const errors = currentIntegration.id ? editErrors : addErrors;

    if (_.isEmpty(errors)) {
      return null;
    }

    const err = errors[0];

    return (
      <RequestError variant="omega" textColor="danger500">
        {err.message}
      </RequestError>
    );
  };

  const renderAddModal = () => {
    if (!showAddModal) {
      return null;
    }

    const addBtn = (
      <Button type="submit" form="newIntegration" disabled={formLoading}>
        {currentIntegration.id ? 'Edit' : 'Add'}
      </Button>
    );

    const cancelBtn = (
      <Button
        variant="tertiary"
        onClick={() => setShowAddModal(false)}
        disabled={formLoading}
      >
        Cancel
      </Button>
    );
    return (
      <ModalLayout onClose={() => setShowAddModal(false)}>
        <ModalHeader>
          <Typography>{currentIntegration.id ? 'Edit integration' : 'Add new integration'}</Typography>
        </ModalHeader>
        <ModalBody>
          <NewIntegrationForm id="newIntegration" onSubmit={handleAddIntegrationSubmit}>
            <TextInput
              label="Name"
              placeholder="Production instance"
              onChange={handleFieldChange('name')}
              value={currentIntegration.name}
              required
              error={integrationFormErrors.name}
              disabled={formLoading}
            />
            <TextInput
              label="Base url"
              onChange={handleFieldChange('url')}
              value={currentIntegration.url}
              required
              placeholder="https://strapi-instance.com"
              type="url"
              error={integrationFormErrors.url}
              disabled={formLoading || currentIntegration.id}
            />
            <Textarea
              label="Token"
              placeholder={currentIntegration.id ? 'Hidden' : 'e2b2c05de3cfea1fe89397391c6647b2607c...'}
              onChange={handleFieldChange('token')}
              value={currentIntegration.token}
              required
              error={integrationFormErrors.token}
              disabled={formLoading || currentIntegration.id}
            />
          </NewIntegrationForm>
          {renderRequestErrors()}
        </ModalBody>
        <ModalFooter startActions={addBtn} endActions={cancelBtn} />
      </ModalLayout>
    );
  };

  return (
    <PageContainer>
      <HeaderContainer>
        <PageTitle variant="alpha">
          Content transfer integrations
        </PageTitle>
        <Button onClick={() => setShowAddModal(true)}>Add new integration</Button>
      </HeaderContainer>
      {renderIntegrations()}
      {renderAddModal()}
      <Alert
        variant="success"
        title={getAlertTitle()}
        show={Boolean(successAlert)}
        onClose={() => setSuccessAlert('')}
      />
    </PageContainer>
  );
};

export default IntegrationsPage;