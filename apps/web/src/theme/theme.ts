import { createTheme, type MantineColorsTuple, type MantineTheme } from '@mantine/core';

// Custom status colors (semantic colors)
const green: MantineColorsTuple = [
  '#E6FCF0',
  '#C3F9DD',
  '#9EF7C8',
  '#76F5B1',
  '#51CF66', // 4 - Active / Success
  '#40C057',
  '#37B24D',
  '#2F9E44',
  '#2B8A3E',
  '#2 7753C',
];

const gray: MantineColorsTuple = [
  '#F8F9FA',
  '#F1F3F5',
  '#E9ECEF',
  '#DEE2E6',
  '#CED4DA',
  '#ADB5BD',
  '#868E96', // 6 - Inactive / Off
  '#495057',
  '#343A40',
  '#212529',
];

const yellow: MantineColorsTuple = [
  '#FFF9DB',
  '#FFF3BF',
  '#FFEC99',
  '#FFE066',
  '#FCC419', // 4 - Starting / In Progress
  '#FAB005',
  '#F59F00',
  '#F08C00',
  '#E67700',
  '#D9480F',
];

const red: MantineColorsTuple = [
  '#FFE3E3',
  '#FFC9C9',
  '#FFA8A8',
  '#FF8787',
  '#FF6B6B', // 4 - Error
  '#FA5252',
  '#F03E3E',
  '#E03131',
  '#C92A2A',
  '#B02525',
];

const orange: MantineColorsTuple = [
  '#FFF4E6',
  '#FFE8CC',
  '#FFD8A8',
  '#FFC078',
  '#FF922B', // 4 - Stopping
  '#FD7E14',
  '#F76707',
  '#E8590C',
  '#D9480F',
  '#BF400D',
];

// Primary blue (tech accent)
const blue: MantineColorsTuple = [
  '#E7F5FF',
  '#D0EBFF',
  '#A5D8FF',
  '#74C0FC',
  '#339AF0', // 4 - Primary (tech blue)
  '#228BE6',
  '#1C7ED6',
  '#1971C2',
  '#1864AB',
  '#145591',
];

export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji',
  fontFamilyMonospace: 'JetBrains Mono, Monaco, Courier, monospace',

  colors: {
    blue,
    green,
    gray,
    yellow,
    red,
    orange,
  },

  // Dark mode colors
  black: '#1A1B1E', // Background principal (dark.8)
  white: '#C1C2C5', // Text principal (dark.0)

  // Override default theme values for dark mode
  other: {
    cardBackground: '#25262B', // dark.7 - cartes/navbar
    elevatedBackground: '#2C2E33', // dark.6 - hover
  },

  // Focus ring configuration (blue, 2px)
  focusRing: 'always',

  // Responsive breakpoints (Mantine standard)
  breakpoints: {
    xs: '576px',
    sm: '768px', // Mobile → Tablet
    md: '992px', // Tablet → Desktop
    lg: '1200px',
    xl: '1400px',
  },

  // Spacing scale (Mantine standard, multiples of 4px/8px)
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  // Component overrides
  components: {
    AppShell: {
      styles: (theme: MantineTheme) => ({
        header: {
          backgroundColor: theme.other.cardBackground,
          borderBottom: `1px solid ${theme.colors.dark[5]}`,
        },
        navbar: {
          backgroundColor: theme.other.cardBackground,
        },
        main: {
          backgroundColor: theme.black,
        },
      }),
    },

    Card: {
      styles: (theme: MantineTheme) => ({
        root: {
          backgroundColor: theme.other.cardBackground,
        },
      }),
    },

    Badge: {
      defaultProps: {
        size: 'sm',
      },
    },

    Button: {
      styles: () => ({
        root: {
          minHeight: '44px', // Minimum touch target (a11y)
        },
      }),
    },

    ActionIcon: {
      styles: () => ({
        root: {
          minWidth: '44px', // Minimum touch target (a11y)
          minHeight: '44px',
        },
      }),
    },
  },
});
