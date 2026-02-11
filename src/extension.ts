import * as vscode from 'vscode';
import { SchemaProvider } from './schemaProvider';

let schemaProvider: SchemaProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  schemaProvider = new SchemaProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      SchemaProvider.viewType,
      schemaProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );
}

export function deactivate() {
  schemaProvider?.dispose();
}
