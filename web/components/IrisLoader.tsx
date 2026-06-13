/** On-brand loading indicator: a spinning iris ring with a pulsing pupil. */
export function IrisLoader({
  size = 18,
  label = "loading",
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="iris-loader"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <span className="iris-ring" />
      <span className="iris-pupil" />
    </span>
  );
}
