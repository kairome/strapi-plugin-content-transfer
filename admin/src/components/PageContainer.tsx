import styled from 'styled-components';
import { DesignSystemProvider, Box, darkTheme, lightTheme } from '@strapi/design-system';
import React from 'react';

const Container = styled(Box)`
  padding: 40px 56px;
`;


const PageContainer: React.FC = (props) => {
  const selectedTheme = localStorage.getItem('STRAPI_THEME');
  const theme = selectedTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <Container>
      <DesignSystemProvider theme={theme}>
        {props.children}
      </DesignSystemProvider>
    </Container>
  );
};

export default PageContainer;