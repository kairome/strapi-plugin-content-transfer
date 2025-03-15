import React, { useState } from 'react';
import _ from 'lodash';
import { Accordion, AccordionContent, AccordionToggle, Typography } from '@strapi/design-system';
import styled from 'styled-components';
import { ErrorItem } from 'types/data';

const ErrorsWrapper = styled.div`
  margin: 0 15px;
`;

const ErrorItem = styled.p`
  margin: 10px 0;
`;

const ErrorDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

interface Props {
  errors: ErrorItem[],
  action: string,
  collectionName: string,
}

const ErrorsList = (props: Props) => {
  const { errors, action, collectionName } = props;

  const [expandedErrors, setExpandedErrors] = useState(false);

  const errorsList = _.map(errors, (error) => {
    return (
      <ErrorItem key={error.message}>
        <Typography variant="beta">{error.message}</Typography>
        <ErrorDetails>
          {_.map(error.details, d => (<Typography textColor="danger500" key={d.message}>{d.message}</Typography>))}
        </ErrorDetails>
      </ErrorItem>
    );
  });

  return (
    <>
      <Accordion
        size="S"
        id="errors"
        error=" "
        expanded={expandedErrors}
        onToggle={() => setExpandedErrors(!expandedErrors)}
      >
        <AccordionToggle title={`There were errors ${action}ing ${collectionName} entities`} />
        <AccordionContent>
          <ErrorsWrapper>
            {errorsList}
          </ErrorsWrapper>
        </AccordionContent>
      </Accordion>
      <br />
    </>
  );
};

export default ErrorsList;