// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { getQuery, createObjectForField } from "./helpers.ts";
import { assertEquals } from "./test_deps.ts";
import { createMockContext } from "./testing.ts";

const { test } = Deno;

test({
  name: "getQuery - basic",
  fn() {
    const ctx = createMockContext({ path: "/?foo=bar&bar=baz" });
    assertEquals(getQuery(ctx), { foo: "bar", bar: "baz" });
  },
});

test({
  name: "getQuery - asMap",
  fn() {
    const ctx = createMockContext({ path: "/?foo=bar&bar=baz" });
    assertEquals(
      Array.from(getQuery(ctx, { asMap: true })),
      [["foo", "bar"], ["bar", "baz"]],
    );
  },
});

test({
  name: "getQuery - merge params",
  fn() {
    const ctx = createMockContext(
      { params: { foo: "qat", baz: "qat" }, path: "/?foo=bar&bar=baz" },
    );
    assertEquals(
      getQuery(ctx, { mergeParams: true }),
      { foo: "bar", baz: "qat", bar: "baz" },
    );
  },
});

test({
  name: "creating object from string keys corresponding to the AsyncIterableIterator keys and values received from .stream() method on form-data body",
  fn: async (t) => {
    await t.step({
      name: "basic case",
      fn: () => {
        const startObj = {};
        let key = "data";
        let value: unknown = 12;
        assertEquals(
          JSON.stringify(createObjectForField(startObj, key, value)),
          '{"data":12}',
        );
        key = "ok";
        value = true;
        assertEquals(
          JSON.stringify(createObjectForField(startObj, key, value)),
          '{"data":12,"ok":true}'
        )
      }
    });
    await t.step({
      name: "simple nesting",
      fn: () => {
        let key = "reminder[testing]";
        const tempObj = {};
        let value = 51;
        assertEquals(
          JSON.stringify(createObjectForField(tempObj,key, value)),
          '{"reminder":{"testing":51}}',
        );
        
        key = "testingFirst";
        value = 15;
        assertEquals(
          JSON.stringify(createObjectForField(tempObj, key, value)),
          '{"reminder":{"testing":51},"testingFirst":15}',
        );
      }
    });
    await t.step({
      name: "nested fields with array",
      fn: () => {
        let key = "reminder[fulfilled][id][]";
        let value = 55;
        const tempObj = {};
        assertEquals(
          JSON.stringify(createObjectForField(tempObj, key, value)),
          '{"reminder":{"fulfilled":{"id":[55]}}}',
        );

         key= "top[middle][bottom][]";
        value = 101;
        assertEquals(
          JSON.stringify(createObjectForField(tempObj, key, value)),
          '{"reminder":{"fulfilled":{"id":[55]}},"top":{"middle":{"bottom":[101]}}}',
        );

        // attempting to add additional values to an existing key
        value = 102
        assertEquals(
          JSON.stringify(createObjectForField(tempObj, key, value)),
          '{"reminder":{"fulfilled":{"id":[55]}},"top":{"middle":{"bottom":[101,102]}}}',
        );

         key= "top[middle][base]";
        value = 999;
        assertEquals(
          JSON.stringify(createObjectForField(tempObj, key, value)),
          '{"reminder":{"fulfilled":{"id":[55]}},"top":{"middle":{"bottom":[101,102],"base":999}}}',
        );
      }
    })
  }
});