import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'ledger',
  primaryShade: 6,
  black: '#17233A',
  white: '#FFFFFF',
  colors: { ledger: ['#eef8f4', '#dbf0e7', '#b8e1d2', '#91d0bb', '#66bba0', '#39a285', '#16866A', '#0f7159', '#095b47', '#054536'] },
  fontFamily: 'Inter, sans-serif',
  headings: { fontFamily: 'Inter, sans-serif', fontWeight: '650' },
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { fw: 550 } },
    Paper: { defaultProps: { withBorder: true } },
    Badge: { defaultProps: { variant: 'light', radius: 'sm', tt: 'none', fw: 550 } },
    Table: { defaultProps: { verticalSpacing: 'md', horizontalSpacing: 'md', highlightOnHover: true } },
  },
});

export const cssVariablesResolver = () => ({
  variables: {
    '--mantine-color-body': '#F8FAF9',
    '--mantine-color-text': '#17233A',
    '--mantine-color-default-border': '#E6EAE8',
  },
  light: {},
  dark: {},
});
