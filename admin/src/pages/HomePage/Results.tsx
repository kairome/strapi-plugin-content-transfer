import React, { useState } from 'react';
import styled from 'styled-components';
import { Accordion, AccordionContent, AccordionToggle, Link } from '@strapi/design-system';
import { Entity } from 'types/data';
import _ from 'lodash';

const ResultsWrapper = styled.div`
  margin: 15px 18px;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ResultItem = styled.div`
`;

interface Props {
  results: Entity[],
  action: string,
  mainField: string,
  integrationUrl: string,
  entityId: string,
}

const Results = (props: Props) => {
  const { results, action, integrationUrl, entityId, mainField } = props;

  const [expandResults, setExpandResults] = useState(false);

  const entityUrl = `${integrationUrl}/admin/content-manager/collection-types/${entityId}`;

  const resultsList = _.map(results, (result) => {
    const { locale } = result;
    const localeQuery = locale ? `?plugins[i18n][locale]=${locale}` : '';
    return (
      <ResultItem key={result.id}>
        <Link href={`${entityUrl}/${result.id}${localeQuery}`}>
          {result[mainField]} {locale ? `(${locale})` : null}
        </Link>
      </ResultItem>
    );
  });

  return (
    <>
      <Accordion
        size="S"
        id="results"
        expanded={expandResults}
        variant="secondary"
        onToggle={() => setExpandResults(!expandResults)}
      >
        <AccordionToggle title={`Successfully ${action}ed ${results.length} entities`} />
        <AccordionContent>
          <ResultsWrapper>
            {resultsList}
          </ResultsWrapper>
        </AccordionContent>
      </Accordion>
      <br />
    </>
  );
};

export default Results;