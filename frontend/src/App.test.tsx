import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

// Sanity test for the test harness (Vitest + RTL + jsdom). Not a component
// spec — there's nothing meaningful to verify about a scaffold's empty shell.
// Real component tests land with the components themselves.
describe('test harness', () => {
  it('renders the app root so the harness is confirmed working', () => {
    render(<App />);
    expect(screen.getByTestId('app-title')).toHaveTextContent('See++');
    expect(screen.getByTestId('app-subtitle')).toBeInTheDocument();
  });
});
