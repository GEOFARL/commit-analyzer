import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";

// Explicit annotation keeps TypeScript from trying to name the anonymous
// subclass Octokit.plugin() returns; we lose the plugin-specific method
// augmentation on the subclass itself, but the ambient module augmentation
// from @octokit/plugin-throttling still reaches Octokit's Options type so
// the `throttle` constructor option is still type-checked.
export const PluggedOctokit: typeof Octokit = Octokit.plugin(throttling, retry);

export type PluggedOctokitInstance = Octokit;
