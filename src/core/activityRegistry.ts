import type { ActivityContext, ActivityModule } from './activity';

const activityRegistry = {
  meadow: () => import('../activities/meadow/MeadowActivity'),
} satisfies Record<string, () => Promise<{ createActivity: ActivityModule }>>;

export type ActivityId = keyof typeof activityRegistry;

export async function loadActivity(
  id: ActivityId,
  context: ActivityContext,
) {
  const module = await activityRegistry[id]();
  return module.createActivity(context);
}
