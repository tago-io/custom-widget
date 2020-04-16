import { ITagoVariables, IVariable } from "./interfaces";

function enableAutofill(variables: Array<IVariable>, widgetVariables: Array<ITagoVariables>): Array<IVariable> {
  const autoFillArray: Array<IVariable> = [];
  variables.map((userVar: IVariable) => {
    widgetVariables.map((widgetVar: ITagoVariables) => {
      if (userVar.variable == widgetVar.variable) {
        autoFillArray.push({
          bucket: widgetVar.origin.bucket || "",
          origin: widgetVar.origin.id || "",
          ...userVar,
        });
      }
    });
  });

  return autoFillArray;
}

export { enableAutofill };
