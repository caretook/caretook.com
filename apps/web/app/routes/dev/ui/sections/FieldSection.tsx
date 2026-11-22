import { Field } from "~/components/ui";
import { Example } from "../Example";

export function FieldSection() {
  return (
    <>
      <Example label="With help">
        <Field kind="input" label="Name" help="As the care team knows them." className="w-full">
          {(control) => <input {...control} defaultValue="Rosa Delgado" />}
        </Field>
      </Example>
      <Example label="With an error, and with a warning">
        <Field kind="input" label="Email" error="Enter an email address." className="w-full">
          {(control) => <input {...control} type="email" />}
        </Field>
        <Field kind="input" label="Dose" warning="That's more than the usual dose." className="w-full">
          {(control) => <input {...control} defaultValue="4 tablets" />}
        </Field>
      </Example>
      <Example label="A select and a textarea">
        <Field kind="select" label="Unit" className="w-full">
          {(control) => (
            <select {...control} defaultValue="mg">
              <option value="mg">mg</option>
              <option value="ml">ml</option>
            </select>
          )}
        </Field>
        <Field kind="textarea" label="Notes" className="w-full">
          {(control) => <textarea {...control} rows={2} />}
        </Field>
      </Example>
    </>
  );
}
