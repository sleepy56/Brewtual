export type Circle = {
 id: string; name: string;
 members: { userId: string; user: { id: string; email: string } }[];
 goals: { id: string; ownerId: string; title: string; progress: number; target: number; cheers: {userId: string}[] }[];
 offers: { id: string; authorId: string; goalId: string; title: string; pledges: {userId: string}[] }[];
};
