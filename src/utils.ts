import { ITagoVariables, IVariable } from "./interfaces";

/**
 * Increase the bucket and origin in the variables that will be sent to TagoIO
 * @param variables variables to be sent to TagoIO
 * @param widgetVariables widget variables loaded when starting
 * @return the autofill of the variables found
 */
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
