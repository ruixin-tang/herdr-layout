import { exec, notify, playSound } from "herdr";

// Deploys of the platform. Pushing master to staging, or staging to production, makes
// CircleCI's build-and-deploy job deploy it; `bin/deploy <env>` does that push after showing
// the commits and asking. This file only reads GitHub: when the branch was last pushed, what
// the job said since then, and how many commits wait. The job's status hangs on the commit,
// and the same commit goes to staging first and production later, so only a status newer
// than the branch's push counts: an older one is the other environment's deploy.
const API = "repos/floryndev/floryn", JOB = "ci/circleci: build-and-deploy";
export const ENVS = [
  { id: "staging", name: "Staging", from: "master", next: "Time to test." },
  { id: "production", name: "Production", from: "staging", next: "Time to post the deploy messages." },
];

const gh = async (path, jq) => JSON.parse((await exec("gh", ["api", path, "--jq", jq])).stdout);

// { sha, pushed, state: "waiting" (CI has not started) | "deploying" | "deployed" | "failed",
//   at (of that state), url (the job on CircleCI), ahead (commits on `from` not deployed here) }
export async function read(env) {
  const [push] = await gh(`${API}/activity?ref=refs/heads/${env.id}&per_page=1`, "[.[] | {sha: .after, at: .timestamp}]");
  const [runs, ahead] = await Promise.all([
    gh(`${API}/commits/${push.sha}/statuses?per_page=100`, `[.[] | select(.context == "${JOB}") | {state, at: .created_at, url: .target_url}]`),
    gh(`${API}/compare/${env.id}...${env.from}`, ".ahead_by"),
  ]);
  const pushed = Date.parse(push.at), run = runs.find((r) => Date.parse(r.at) >= pushed);
  const state = !run ? "waiting" : run.state === "pending" ? "deploying" : run.state === "success" ? "deployed" : "failed";
  return { sha: push.sha.slice(0, 7), pushed, state, at: run ? Date.parse(run.at) : pushed, ahead,
    url: run?.url ?? `https://app.circleci.com/pipelines/github/floryndev/floryn?branch=${env.id}` };
}

// Says once that a deploy ended. The first time it only remembers what it found, so a
// deploy that was over before this ran is not announced.
export function tell(env, d) {
  const over = d.state === "deployed" || d.state === "failed", key = `${d.sha} ${d.state} ${d.at}`, told = localStorage.getItem(`told-${env.id}`);
  if (told === null) { localStorage.setItem(`told-${env.id}`, over ? key : "-"); return; }
  if (!over || told === key) return;
  localStorage.setItem(`told-${env.id}`, key);
  const mins = Math.round((d.at - d.pushed) / 60000);
  if (d.state === "deployed") notify({ title: `${env.name} is deployed`, body: `${d.sha}, after ${mins} min. ${env.next}`, level: "success" });
  else notify({ title: `${env.name} deploy failed`, body: `${d.sha}: build-and-deploy failed on CircleCI.`, level: "error" });
  playSound(d.state === "deployed" ? "done" : "blocked");
}
