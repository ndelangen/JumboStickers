/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as album from "../album.js";
import type * as collectors from "../collectors.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as digest from "../digest.js";
import type * as districts from "../districts.js";
import type * as exchange from "../exchange.js";
import type * as http from "../http.js";
import type * as localIdentity from "../localIdentity.js";
import type * as localOrigin from "../localOrigin.js";
import type * as marketplace from "../marketplace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  album: typeof album;
  collectors: typeof collectors;
  crons: typeof crons;
  demo: typeof demo;
  digest: typeof digest;
  districts: typeof districts;
  exchange: typeof exchange;
  http: typeof http;
  localIdentity: typeof localIdentity;
  localOrigin: typeof localOrigin;
  marketplace: typeof marketplace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
