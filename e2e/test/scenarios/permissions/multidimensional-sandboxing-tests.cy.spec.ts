import { preparePermissions } from "./utils";

H.describeEE(
  "admin > permissions > sandboxing (multidimensional tests)",
  () => {
    describe("admin", () => {
      beforeEach(() => {
        H.restore();
        cy.signInAsAdmin();
        H.setTokenFeatures("all");
        preparePermissions();
      });
      it("test that we can create two users with different attributes and sandbox a table so that one sees the first half of the rows, the other sees the other half of the rows", () => {
        //
      });
    });
  },
);
