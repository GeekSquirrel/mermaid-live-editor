import { test } from './test';

test.describe('Error display tests', () => {
  test('should display syntax error for invalid diagram syntax without AI upsell', async ({
    editPage
  }) => {
    // Enter code with syntax error
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B -->');

    // Verify error is displayed
    await editPage.checkError('Syntax error');

    // Verify AI Repair button and help text are not visible
    await editPage.checkAIHelperVisibility(false);
  });

  test('should display syntax error for invalid YAML frontmatter config', async ({ editPage }) => {
    // Enter code with invalid YAML frontmatter
    await editPage.clearEditor();
    await editPage.typeInEditor('---\nconfig:\n  theme: [invalid\n---\ngraph TD\nA --> B');

    // Verify error is displayed
    await editPage.checkError('Syntax error');

    // Verify AI Repair button and help text are not visible
    await editPage.checkAIHelperVisibility(false);
  });
});
