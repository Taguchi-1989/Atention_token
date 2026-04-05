import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// Simple smoke test
describe('Application Setup', () => {
  it('jest is properly configured', () => {
    expect(true).toBe(true);
  });

  it('can render basic React component', () => {
    const TestComponent = () => <div data-testid="test">Hello Test</div>;
    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('Hello Test');
  });
});
