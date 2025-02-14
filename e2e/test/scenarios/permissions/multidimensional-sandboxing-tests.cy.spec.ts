import { USER_GROUPS } from "e2e/support/cypress_data";
import {
  usedAliases,
  multidimensionalSandboxingTestUser as user,
} from "e2e/support/helpers";

const { H } = cy;

const preparePermissions = () => {
  H.blockUserGroupPermissions(USER_GROUPS.ALL_USERS_GROUP);
  H.blockUserGroupPermissions(USER_GROUPS.COLLECTION_GROUP);
  H.blockUserGroupPermissions(USER_GROUPS.READONLY_GROUP);
};

describe("admin > permissions > sandboxing (multidimensional tests)", () => {
  describe("we can apply a sandbox policy", () => {
    beforeEach(() => {
      H.restore();
      cy.signInAsAdmin();
      H.setTokenFeatures("all");
      preparePermissions();
      cy.intercept("POST", "/api/card").as("saveQuestion");
      cy.createUserFromRawData(user);
      usedAliases.clear();
    });

    it("to a table filtered using a question as a custom view", () => {
      const columnType = "regular";
      const filterTableBy = "custom_view";
      const customColumnType = undefined;
      H.configureAndVerifySandboxPolicy({
        columnType,
        filterTableBy,
        customColumnType,
      });
    });

    it("to a table filtered using a model as a custom view", () => {
      const columnType = "regular";
      const filterTableBy = "custom_view";
      const customViewType = "model";
      const customColumnType = undefined;
      H.configureAndVerifySandboxPolicy({
        columnType,
        filterTableBy,
        customColumnType,
        customViewType,
      });
    });

    it("to a table filtered by a regular column", () => {
      const columnType = "regular";
      const customColumnType = undefined;
      H.configureAndVerifySandboxPolicy({
        columnType,
        customColumnType,
      });
    });

    // This behavior might be genuinely broken?
    // The test fails at the end because the question errors with:
    // Invalid query: {:stages [["Invalid :expression reference: no expression named {:base-type :type/Boolean}"]]}
    it.skip("to a table filtered by a custom boolean column", () => {
      const columnType = "custom";
      const customColumnType = "boolean";
      H.configureAndVerifySandboxPolicy({
        columnType,
        customColumnType,
      });
    });

    // This might also be broken? The query errors with: Invalid output:
    // {:stages [["Invalid :expression reference: no expression named
    // {:base-type :type/Text}, got: {:lib/type :mbql.stage/mbql, :source-table
    // 8, :expressions [[:concat {:lib/uuid
    // \"ea22b763-c949-4594-8c74-9f035f2ab082\", :lib/expression-name \"Custom
    // category\", :ident \"wVGz1eygzUKw_KsNuclmb\"} \"Category is \" [:field
    // {:base-type :type/Text, :lib/uuid
    // \"0b940027-7008-4cbf-8bf7-accb66167ed2\", :effective-type :type/Text}
    // 58]]], :parameters [{:type :category, :target [:dimension [:expression
    it.skip("to a table filtered by a custom string column", () => {
      const columnType = "custom";
      const customColumnType = "string";
      H.configureAndVerifySandboxPolicy({
        columnType,
        customColumnType,
      });
    });

    // Also fails with a similar error
    it.skip("to a table filtered by a custom number column", () => {
      const columnType = "custom";
      const customColumnType = "number";
      H.configureAndVerifySandboxPolicy({
        columnType,
        customColumnType,
      });
    });
  });
});
