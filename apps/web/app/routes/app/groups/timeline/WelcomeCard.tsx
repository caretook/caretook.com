import { X } from "lucide-react";
import { Card, IconButton } from "~/components/ui";

/**
 * A new viewer's or Easy role's welcome: what their role can do, in words.
 * No links or actions but Dismiss, so it offers nothing they can't do.
 */
export function WelcomeCard({
  text,
  easy,
  className,
  onDismiss,
}: {
  text: string;
  easy: boolean;
  className: string;
  onDismiss: () => void;
}) {
  return (
    <Card
      id="welcome"
      title="Welcome"
      className={className}
      data-welcome-card=""
      actions={<IconButton label="Dismiss welcome" icon={X} onPress={onDismiss} />}
    >
      <p className={`text-base-content/70 ${easy ? "text-base" : "text-sm"}`}>{text}</p>
    </Card>
  );
}
