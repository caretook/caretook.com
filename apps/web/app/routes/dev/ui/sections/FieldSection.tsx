import { Field } from "~/components/ui";
import { Example } from "../Example";

export function FieldSection() {
  return (
    <>
      <Example label="With help">
        <Field label="Name" help="As the care team knows them." className="w-full">
          {(control) => <input {...control} className="input w-full" defaultValue="Rosa Delgado" />}
        </Field>
      </Example>
      <Example label="With an error, and with a warning">
        <Field label="Email" error="Enter an email address." className="w-full">
          {(control) => <input {...control} className="input input-error w-full" type="email" />}
        </Field>
        <Field label="Dose" warning="That's more than the usual dose." className="w-full">
          {(control) => <input {...control} className="input w-full" defaultValue="4 tablets" />}
        </Field>
      </Example>
      <Example label="A select and a textarea">
        <Field label="Unit" className="w-full">
          {(control) => (
            <select {...control} className="select w-full" defaultValue="mg">
              <option value="mg">mg</option>
              <option value="ml">ml</option>
            </select>
          )}
        </Field>
        <Field label="Notes" className="w-full">
          {(control) => <textarea {...control} className="textarea w-full" rows={2} />}
        </Field>
      </Example>
    </>
  );
}
