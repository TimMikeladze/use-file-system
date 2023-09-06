import React from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { Example } from './Example';

export default {
  title: 'Example',
  component: Example,
  argTypes: {},
} as Meta<typeof Example>;

const Template: StoryFn<typeof Example> = () => <Example />;

export const Primary = Template.bind({});

Primary.args = {};
