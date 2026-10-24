# Friend circles and connection codes

Brewtual provides two separate kinds of shared space: a two-person partner space and a friend circle with multiple members. After signing in on the website, open **Invite / Join**, **Together**, or the connection shortcut in **Settings**.

## Partner connections

Create a partner space from Together before generating a `PAIR-` code. Share it privately with your partner, who joins using their own account.

- A partner space holds exactly two accounts.
- Codes expire after seven days and are single-use.
- An account can belong to only one partner space.
- Existing email-bound partner invitations continue to work.

## Friend circles

Create a named circle or enter a friend’s `GROUP-` code. You can belong to multiple circles, independently of your partner connection.

- A group code can be reused by multiple friends for seven days.
- Circle members can generate new codes for their circle.
- Anyone who possesses a valid group code can join, so share it only with intended members.
- Only code hashes are stored in the database.

## Personal tasks and space tokens

Your private planner works independently of circles. Use **Ask for tokens** to share selected work with a connected group for approval. Each circle has its own token balance and reward market. See the [personal planner guide](PERSONAL_PLANNER.md).

## Shared circle goals and encouragement

Add a title and a target number of steps. Use a target of 1 for a single task, or a larger number for a milestone. The owner can log a step or undo one; other members cannot change their progress. Progress cannot exceed the goal’s target.

Friends can cheer once per goal. A cheer is encouragement, not an edit to someone else’s task.

## Milestone promises

A member can offer something kind when a goal is completed, such as “I’ll treat you to coffee.” The offer must reference a goal in that circle. Other members explicitly opt in with **Count me in**.

When the goal reaches its target, the offer shows that the milestone has been reached. Friends arrange fulfillment themselves. These offers do not transfer money, spend partner tokens, or automatically obligate other members.

## What members can see

Members see account emails, tasks/goals, progress, cheers, and milestone promises within their own circle. Only goals added to that circle are shared there. Partner habits, partner rewards, and token balances stay in the partner space.

Server membership checks protect circle operations. Only the goal owner can update its progress, and cheers, offers, and pledges must belong to the selected circle.

## Database setup

Apply `npm run db:migrate` before using these features, including on existing databases. The additive `20261023170000_friend_circles` migration preserves existing partner records. See [deployment and phones](DEPLOYMENT_AND_MOBILE_PLAN.md) for hosting instructions and [development](DEVELOPMENT.md) for checks and verification limits.
