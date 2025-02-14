import { P, match } from "ts-pattern";

import { USER_GROUPS } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import {
  createDashboard,
  createQuestion,
  enterCustomColumnDetails,
  entityPickerModal,
  entityPickerModalTab,
  filter,
  getNotebookStep,
  modal,
  modifyPermission,
  openNotebook,
  popover,
  saveChangesToPermissions,
  startNewQuestion,
  visitDashboard,
  visitMetric,
  visitModel,
  visitQuestion,
} from "e2e/support/helpers";
import type { CardType, StructuredQuery } from "metabase-types/api";

const { ALL_USERS_GROUP, DATA_GROUP, COLLECTION_GROUP } = USER_GROUPS;

const { PRODUCTS_ID } = SAMPLE_DATABASE;

type ColumnType = "regular" | "custom";

/** A string describing the data type of a custom column. This is not a mistake
 * - it's a string with three possible values */
type CustomColumnType = "boolean" | "string" | "number";

type FilterTableBy = "column" | "custom_view";
type CustomViewType = "question" | "model";

const customColumnTypeToFormula: Record<CustomColumnType, string> = {
  boolean: '[Category]="Gizmo"',
  string: 'concat("Category is ",[Category])',
  number: 'if([Category] = "Gizmo", 1, 0)',
};

/* To prevent the re-use of aliases, we keep track of which aliases have been
 * used */
export const usedAliases = new Set<string>();

/** Assert that the id alias has not been used before */
const shouldBeUnused = (idAlias: string) => {
  if (usedAliases.has(idAlias)) {
    console.error(
      `Alias "${idAlias}" has already been used. Used aliases: ${JSON.stringify(usedAliases)}`,
    );
  }
  usedAliases.add(idAlias);
};

function isNumber(value: unknown): asserts value is number {
  expect(value).to.be.a("number");
  if (typeof value !== "number") {
    throw new Error(`Expected a number, but got ${value}`);
  }
}

/** Retrieve a wrapped id and pass it to the given callback. Also, ensure that
 * the id has a numeric value */
const withId = (idAlias: string, callback: (id: number) => void) => {
  cy.get("@" + idAlias).then(id => {
    isNumber(id);
    if (!usedAliases.has(idAlias)) {
      throw new Error(`Alias "${idAlias}" has not been marked as used`);
    }
    callback(id);
  });
};

const addCustomColumnToQuestion = (customColumnType: CustomColumnType) => {
  cy.log("Add a custom column");
  getNotebookStep("data").button("Custom column").click();
  enterCustomColumnDetails({
    formula: customColumnTypeToFormula[customColumnType],
    name: "Custom category column",
  });
  popover().button("Done").click();
};

type CreateQuestionOptions = {
  columnType: ColumnType;
  customColumnType?: CustomColumnType;
  idAlias?: string;
  dashboardIdAlias?: string;
  sourceTable?: StructuredQuery["source-table"];
  type?: CardType;
};

const createSavedQuestion = (opts: CreateQuestionOptions) => {
  cy.log(
    "Create a saved question that shows Gizmos and Widgets, and put it in a dashboard",
  );
  const { visitCard: visitSavedQuestion, visitTheDashboard } = createCard(opts);

  return {
    visitSavedQuestion,
    visitDashboardWithSavedQuestion: visitTheDashboard,
  };
};

const createModel = (opts: CreateQuestionOptions) => {
  cy.log(
    "Create a model that shows Gizmos and Widgets, and put it in a dashboard",
  );
  const { visitCard: visitModel, visitTheDashboard: visitDashboardWithModel } =
    createCard({
      ...opts,
      type: "model",
      idAlias: "modelId",
      dashboardIdAlias: "idOfDashboardWithModel",
    });
  return { visitModel, visitDashboardWithModel };
};

const createCard = ({
  columnType,
  customColumnType,
  idAlias = "savedQuestionId",
  dashboardIdAlias = "dashboardId",
  sourceTable = PRODUCTS_ID,
  type = "question",
}: CreateQuestionOptions) => {
  shouldBeUnused(idAlias);
  shouldBeUnused(dashboardIdAlias);
  createQuestion(
    {
      name: "Products question",
      query: {
        "source-table": sourceTable,
      },
      type,
    },
    { wrapId: true, idAlias },
  );

  withId("savedQuestionId", savedQuestionId => {
    createDashboard(
      {
        dashcards: [
          {
            id: 1,
            size_x: 10,
            size_y: 20,
            row: 0,
            col: 0,
            card_id: savedQuestionId,
          },
        ],
      },
      { wrapId: true, idAlias: dashboardIdAlias },
    );
  });

  const visitCard = () => {
    // Get a function that will visit the card
    const visit = match(type)
      .returnType<(id: number) => void>()
      .with("question", () => visitQuestion)
      .with("model", () => visitModel)
      .with("metric", () => visitMetric)
      .exhaustive();

    // Call the function with the id of the saved question, model, or metric
    withId(idAlias, id => visit(id));
    // NOTE: `(id) => visit(id)` is equivalent to `visit`, but I think it's
    // more expressive
  };

  const visitTheDashboard = () => {
    withId(dashboardIdAlias, id => visitDashboard(id));
  };

  if (customColumnType) {
    visitCard();
    addCustomColumnToQuestionAndSave(columnType, customColumnType);
  }

  return {
    visitCard,
    visitTheDashboard,
  };
};

const addCustomColumnToQuestionAndSave = (
  columnType: ColumnType,
  customColumnType: CustomColumnType,
) => {
  openNotebook();
  addCustomColumnToQuestion(customColumnType);
  cy.button("Visualize").click();
  const { attributeValue } = getUserAttribute(columnType, customColumnType);
  cy.findAllByText(attributeValue);

  cy.log(
    "Save a new question, which we'll use as a custom view for the sandboxed table",
  );
  cy.findByTestId("qb-save-button").click();

  modal().within(() => {
    cy.findByText(/Replace or save as new\?/);
    cy.findByRole("radio", {
      name: /Save as new question/,
    }).click();
    cy.findByLabelText("Name")
      .clear()
      .type("Products question with custom column");
    cy.button("Save").click();
  });

  cy.wait("@saveQuestion");

  modal().within(() => {
    cy.findByText("Saved! Add this to a dashboard?");
    cy.button(/Not now/).click();
  });
};

const createNestedQuestion = ({
  nestedQuestionIdAlias = "nestedQuestionId",
  dashboardIdAlias = "idOfDashboardWithNestedQuestion",
}: {
  nestedQuestionIdAlias?: string;
  dashboardIdAlias?: string;
} = {}) => {
  cy.log("Create a nested question and put it in a dashboard");

  withId("savedQuestionId", savedQuestionId => {
    createCard({
      columnType: "regular",
      idAlias: nestedQuestionIdAlias,
      sourceTable: `card__${savedQuestionId}`,
      dashboardIdAlias,
    });
  });
  const visitNestedQuestion = () => {
    withId(nestedQuestionIdAlias, id => visitQuestion(id));
  };
  const visitDashboardWithNestedQuestion = () => {
    withId(dashboardIdAlias, id => visitDashboard(id));
  };
  return { visitNestedQuestion, visitDashboardWithNestedQuestion };
};

const createAdhocQuestion = ({
  customColumnType,
}: {
  customColumnType?: CustomColumnType;
}) => {
  startNewQuestion();
  entityPickerModal().within(() => {
    entityPickerModalTab("Tables").click();
    cy.findByText("Products").click();
  });
  if (customColumnType) {
    addCustomColumnToQuestion(customColumnType);
  }
  cy.button("Visualize").click();
};

export const multidimensionalSandboxingTestUser = {
  email: "user@company.com",
  password: "--------",
  user_group_memberships: [
    { id: ALL_USERS_GROUP, is_group_manager: false },
    { id: DATA_GROUP, is_group_manager: false },
    { id: COLLECTION_GROUP, is_group_manager: false },
  ],
};

const signInAsSandboxedUser = () => {
  cy.log(
    `Sign in as user via an API call: ${multidimensionalSandboxingTestUser.email}`,
  );
  cy.request("POST", "/api/session", {
    username: multidimensionalSandboxingTestUser.email,
    password: multidimensionalSandboxingTestUser.password,
  });
};

const shouldBeUnfiltered = () => {
  cy.findAllByText("Gizmo").should("exist");
  cy.findAllByText("Widget").should("exist");
};

const shouldBeFiltered = () => {
  cy.findAllByText("Gizmo").should("exist");
  cy.findAllByText("Widget").should("not.exist");
};

const editFirstUser = () => {
  cy.log("Add login attribute");
  cy.visit("/admin/people");
  cy.icon("ellipsis").first().click();
  popover().findByText("Edit user").click();
  modal()
    .button(/Add an attribute/)
    .click();
};

const getUserAttribute = (
  columnType: ColumnType,
  customColumnType?: CustomColumnType,
) => {
  return match([columnType, customColumnType])
    .with(["regular", P._], () => ({
      attributeKey: "can see category",
      attributeValue: "Gizmo",
    }))
    .with(["custom", "boolean"], () => ({
      attributeKey: "is_gizmo",
      attributeValue: "true",
    }))
    .with(["custom", "string"], () => ({
      attributeKey: "can see products where",
      attributeValue: "Category is Gizmo",
    }))
    .with(["custom", "number"], () => ({
      attributeKey: "can see gizmos",
      attributeValue: "1",
    }))
    .otherwise(() => {
      throw new TypeError("Unexpected columnType or customColumnType");
    });
};

const configureUser = ({
  columnType,
  customColumnType,
}: {
  columnType: ColumnType;
  customColumnType?: CustomColumnType;
}) => {
  const { attributeKey, attributeValue } = getUserAttribute(
    columnType,
    customColumnType,
  );
  assignAttributeToUser({ attributeKey, attributeValue });
  return { attributeKey };
};

const assignAttributeToUser = ({
  attributeKey,
  attributeValue,
}: {
  attributeKey: string;
  attributeValue: string;
}) => {
  editFirstUser();
  cy.findByPlaceholderText("Key").type(attributeKey);
  cy.findByPlaceholderText("Value").type(attributeValue);
  cy.button("Update").click();
  modal().should("not.exist");
  cy.findByTestId("admin-people-list-table").should("exist");
};

const configureSandboxPolicy = ({
  columnType,
  attributeKey,
  filterTableBy,
}: {
  columnType: ColumnType;
  attributeKey: string;
  filterTableBy?: FilterTableBy;
}) => {
  cy.log("Show the permissions configuration for the Sample Database");
  cy.visit("/admin/permissions/data/database/1");
  cy.log(
    "Show the permissions configuration for the Sample Database's Products table",
  );
  cy.findByRole("menuitem", { name: /Products/ }).click();
  cy.log("Modify the sandboxing policy for the 'data' group");
  modifyPermission("data", 0, "Sandboxed");

  modal().within(() => {
    cy.findByText(/Change access to this database to .*Sandboxed.*?/);
    cy.button("Change").click();
  });

  modal().findByText(/Restrict access to this table/);
  if (columnType === "regular" && filterTableBy !== "custom_view") {
    cy.findByRole("radio", {
      name: /Filter by a column in the table/,
    }).should("be.checked");
  } else if (columnType === "custom" || filterTableBy === "custom_view") {
    cy.findByText(
      /Use a saved question to create a custom view for this table/,
    ).click();
    cy.findByTestId("custom-view-picker-button").click();
    entityPickerModal()
      .findByText(
        filterTableBy === "column"
          ? "Products question with custom column"
          : "Products question custom view",
      )
      .click();
  } else {
    throw new Error("Unexpected columnType");
  }

  if (filterTableBy === "column") {
    modal()
      .findByRole("button", { name: /Pick a column|parameter/ })
      .click();
    const columnName =
      columnType === "regular" ? "Category" : "Custom category column";
    cy.findByRole("option", { name: columnName }).click();
    modal()
      .findByRole("button", { name: /Pick a user attribute/ })
      .click();
    cy.findByRole("option", { name: attributeKey }).click();
  }

  cy.log("Wait for the whole summary to render");
  cy.findByLabelText(/Summary/).contains("data");

  cy.log("Ensure the summary contains the correct text");
  cy.findByLabelText(/Summary/)
    .invoke("text")
    .should(summary => {
      expect(summary).to.contain("Users in data can view");
      if (columnType === "regular") {
        if (filterTableBy === "column") {
          expect(summary).to.contain("rows in the PRODUCTS table");
          expect(summary).to.contain(
            `where Category field equals ${attributeKey}`,
          );
        } else {
          expect(summary).to.contain(
            "rows in the Products question custom view question",
          );
        }
      }
      if (columnType === "custom") {
        expect(summary).to.contain(
          "rows in the Products question with custom column question",
        );
        expect(summary).to.contain(
          `where Custom category column field equals ${attributeKey}`,
        );
      }
    });

  cy.log("Save the sandboxing modal");
  modal().findByRole("button", { name: "Save" }).click();

  saveChangesToPermissions();

  cy.wait(1000); // HACK: If we don't wait here, an error occurs for some reason
  // TODO: Make an assertion about the content of the Save permissions
  // modal. It should say something like 'All Users' will be given access
  // to 1 table in Sample Database
};

// TODO: remove
const quick = true;

/* Set up a sandbox policy and examine its effects on various kinds of cards in various contexts */
export const configureAndVerifySandboxPolicy = ({
  columnType,
  customColumnType,
  filterTableBy,
  customViewType,
}: {
  filterTableBy?: FilterTableBy;
  columnType: ColumnType;
  customColumnType?: CustomColumnType;
  customViewType?: CustomViewType;
}) => {
  const { visitSavedQuestion, visitDashboardWithSavedQuestion } =
    createSavedQuestion({
      columnType,
      customColumnType,
    });

  if (filterTableBy === "custom_view") {
    cy.log(
      "Create a saved question that we'll use as a custom view when configuring the sandboxing policy",
    );
    const { visitSavedQuestion: visitCustomView } = createSavedQuestion({
      columnType: "custom",
      customColumnType: "string",
      type: customViewType === "model" ? "model" : "question",
    });
    visitCustomView();
    filter();

    modal().within(() => {
      cy.findByText("Gizmo").click();
      cy.findByTestId("apply-filters").click();
    });

    cy.findByText("Category is Gizmo");

    cy.findByTestId("qb-save-button").click();
    modal().within(() => {
      cy.findByRole("radio", {
        name: /Save as new question/,
      }).click();
      cy.findByLabelText("Name").clear().type("Products question custom view");
      cy.button("Save").click();
    });

    cy.wait("@saveQuestion");

    modal().within(() => {
      cy.findByText("Saved! Add this to a dashboard?");
      cy.button(/Not now/).click();
    });
  }

  const { visitModel, visitDashboardWithModel } = createModel({
    columnType,
    customColumnType,
    type: "model",
  });

  const { visitNestedQuestion, visitDashboardWithNestedQuestion } =
    createNestedQuestion();

  const visitAdhocQuestion = () =>
    createAdhocQuestion({
      customColumnType,
    });

  signInAsSandboxedUser();

  if (!quick) {
    cy.log("Saved question is not yet filtered");
    visitSavedQuestion();
    shouldBeUnfiltered();

    cy.log("Adhoc question is not yet filtered");
    visitAdhocQuestion();
    shouldBeUnfiltered();

    cy.log("Question based on saved question is not yet filtered");
    visitNestedQuestion();
    shouldBeUnfiltered();

    cy.log("Model is not yet filtered");
    visitModel();
    shouldBeUnfiltered();

    cy.log("Saved question in dashboard is not yet filtered");
    visitDashboardWithSavedQuestion();
    shouldBeUnfiltered();

    cy.log("Nested question is not yet filtered");
    visitNestedQuestion();
    shouldBeUnfiltered();

    cy.log("Nested question in dashboard is not yet filtered");
    visitDashboardWithNestedQuestion();
    shouldBeUnfiltered();
  }

  cy.signInAsAdmin();

  const { attributeKey } = configureUser({ columnType, customColumnType });
  configureSandboxPolicy({ columnType, filterTableBy, attributeKey });
  signInAsSandboxedUser();

  cy.log("Adhoc question is filtered");
  visitAdhocQuestion();
  shouldBeFiltered();

  cy.log("Saved question is filtered");
  visitSavedQuestion();
  shouldBeFiltered();

  cy.log("Saved question in dashboard is filtered");
  visitDashboardWithSavedQuestion();
  shouldBeFiltered();

  cy.log("Nested question is filtered");
  visitNestedQuestion();
  shouldBeFiltered();

  cy.log("Nested question in dashboard is filtered");
  visitDashboardWithNestedQuestion();
  shouldBeFiltered();

  cy.log("Model is filtered");
  visitModel();
  shouldBeFiltered();

  cy.log("Model in dashboard is filtered");
  visitDashboardWithModel();
  shouldBeFiltered();
};
