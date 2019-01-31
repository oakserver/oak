// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import "./application_test.ts";
import "./context_test.ts";
import "./encoding_test.ts";
import "./httpError_test.ts";
import "./isMediaType_test.ts";
import "./mediaType_test.ts";
import "./mediaTyper_test.ts";
import "./middleware_test.ts";
import "./mod_test.ts";
import "./pathToRegExp_test.ts";
import "./request_test.ts";
import "./response_test.ts";
import "./router_test.ts";
import "./send_test.ts";
import "./util_test.ts";

import { runTests } from "https://deno.land/x/std/testing/mod.ts";

runTests();
