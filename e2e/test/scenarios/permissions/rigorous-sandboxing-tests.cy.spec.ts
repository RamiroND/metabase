H.describeEE("admin > permissions > sandboxing", () => {
  describe("admin", () => {
    beforeEach(() => {
      H.restore();
      cy.signInAsAdmin();
      H.setTokenFeatures("all");
      preparePermissions();
      cy.visit("/admin/people");
    });
