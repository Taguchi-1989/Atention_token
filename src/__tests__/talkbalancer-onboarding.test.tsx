import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TalkBalancerSetupSteps } from '@/components/talkbalancer/TalkBalancerSetupSteps';

describe('TalkBalancerSetupSteps', () => {
  it('shows the three decisions needed to start', () => {
    render(<TalkBalancerSetupSteps />);

    expect(screen.getByText('ルール共有')).toBeInTheDocument();
    expect(screen.getByText('モード選択')).toBeInTheDocument();
    expect(screen.getByText('マイク開始')).toBeInTheDocument();
  });

  it('exposes the progress as one ordered list', () => {
    render(<TalkBalancerSetupSteps current={2} />);

    expect(screen.getByRole('list', { name: '開始までの3ステップ' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
