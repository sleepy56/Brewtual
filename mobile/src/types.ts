export type PersonId = 'alex' | 'jamie';

export type TabName = 'today' | 'goals' | 'rewards' | 'activity';

export type Route = {
  name: TabName | 'settings' | 'approvals' | 'new-goal' | 'goal-detail';
  id?: string;
  goalOwner?: 'me' | 'partner' | 'both';
};

export type ScreenProps = {
  navigate: (route: Route) => void;
  goBack: () => void;
  route: Route;
};
