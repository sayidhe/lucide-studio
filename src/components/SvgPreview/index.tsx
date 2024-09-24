import React, { useId } from "react";
import { PathProps, Path } from "./types";
import getPaths, { assert } from "./utils";
import { svgPathBbox } from "svg-path-bbox";
import memoize from "lodash/memoize";
import { getPatternMatches } from "./getPatternMatches";

const Grid = ({
  radius,
  fill,
  size,
  subGridSize = 0,
  ...props
}: {
  size: number;
  strokeWidth: number;
  subGridSize?: number;
  radius: number;
} & PathProps<"stroke", "strokeWidth">) => (
  <g className="svg-preview-grid-group" strokeLinecap="butt" {...props}>
    <rect
      className="svg-preview-grid-rect"
      width={size - props.strokeWidth}
      height={size - props.strokeWidth}
      x={props.strokeWidth / 2}
      y={props.strokeWidth / 2}
      rx={radius}
      fill={fill}
    />
    <path
      strokeDasharray={
        "0 0.1 " +
        "0.1 0.15 ".repeat(subGridSize ? subGridSize * 4 - 1 : 95) +
        "0 0.15"
      }
      strokeWidth={0.1}
      d={
        props.d ||
        new Array(Math.floor(size - 1))
          .fill(null)
          .map((_, i) => i)
          .filter((i) => !subGridSize || i % subGridSize !== subGridSize - 1)
          .flatMap((i) => [
            `M${props.strokeWidth} ${i + 1}h${size - props.strokeWidth * 2}`,
            `M${i + 1} ${props.strokeWidth}v${size - props.strokeWidth * 2}`,
          ])
          .join("")
      }
    />
    {!!subGridSize && (
      <path
        d={
          props.d ||
          new Array(Math.floor(size - 1))
            .fill(null)
            .map((_, i) => i)
            .filter((i) => i % subGridSize === subGridSize - 1)
            .flatMap((i) => [
              `M${props.strokeWidth} ${i + 1}h${size - props.strokeWidth * 2}`,
              `M${i + 1} ${props.strokeWidth}v${size - props.strokeWidth * 2}`,
            ])
            .join("")
        }
      />
    )}
  </g>
);

const Shadow = ({
  radius,
  paths,
  size,
  ...props
}: {
  size: number;
  radius: number;
  paths: Path[];
} & PathProps<"stroke" | "strokeWidth" | "strokeOpacity", "d">) => {
  const groupedPaths = Object.entries(
    paths.reduce(
      (groups, val) => {
        const key = val.c.id;
        groups[key] = [...(groups[key] || []), val];
        return groups;
      },
      {} as Record<number, Path[]>,
    ),
  );
  return (
    <>
      <g className="svg-preview-shadow-mask-group" {...props}>
        {groupedPaths.map(([id, paths]) => (
          <mask
            key={`svg-preview-shadow-mask-${id}`}
            id={`svg-preview-shadow-mask-${id}`}
            maskUnits="userSpaceOnUse"
            strokeOpacity="1"
            strokeWidth={props.strokeWidth}
            stroke="#000"
          >
            <rect
              x={0}
              y={0}
              width={size}
              height={size}
              fill="#fff"
              stroke="none"
              rx={radius}
            />
            <path
              d={paths
                .flatMap(({ prev, next }) => [
                  `M${prev.x} ${prev.y}h.01`,
                  `M${next.x} ${next.y}h.01`,
                ])
                .filter((val, idx, arr) => arr.indexOf(val) === idx)
                .join("")}
            />
          </mask>
        ))}
      </g>
      <g className="svg-preview-shadow-group" {...props}>
        {paths.map(({ d, c: { id } }, i) => (
          <path key={i} mask={`url(#svg-preview-shadow-mask-${id})`} d={d} />
        ))}
        <path
          d={paths
            .flatMap(({ prev, next }) => [
              `M${prev.x} ${prev.y}h.01`,
              `M${next.x} ${next.y}h.01`,
            ])
            .filter((val, idx, arr) => arr.indexOf(val) === idx)
            .join("")}
        />
      </g>
    </>
  );
};

const ColoredPath = ({
  colors,
  paths,
  ...props
}: { paths: Path[]; colors: string[] } & PathProps<never, "d" | "stroke">) => {
  let idx = 0;
  return (
    <g className="svg-preview-colored-path-group" {...props}>
      {paths.map(({ d, c }, i) => (
        <path
          key={i}
          d={d}
          stroke={colors[(c.name === "path" ? idx++ : c.id) % colors.length]}
        />
      ))}
    </g>
  );
};

const ControlPath = ({
  paths,
  radius,
  size,
  pointSize,
  ...props
}: {
  pointSize: number;
  size: number;
  paths: Path[];
  radius: number;
} & PathProps<"stroke" | "strokeWidth", "d">) => {
  const controlPaths = paths.map((path, i) => {
    const element = paths.filter((p) => p.c.id === path.c.id);
    const lastElement = element.at(-1)?.next;
    assert(lastElement);
    const isClosed =
      element[0].prev.x === lastElement.x &&
      element[0].prev.y === lastElement.y;
    const showMarker = !["rect", "circle", "ellipse"].includes(path.c.name);
    return {
      ...path,
      showMarker,
      startMarker: showMarker && path.isStart && !isClosed,
      endMarker: showMarker && paths[i + 1]?.isStart !== false && !isClosed,
    };
  });
  return (
    <>
      <g
        className="svg-preview-control-path-marker-mask-group"
        strokeWidth={pointSize}
        stroke="#000"
      >
        {controlPaths.map(({ prev, next, showMarker }, i) => {
          return (
            showMarker && (
              <mask
                id={`svg-preview-control-path-marker-mask-${i}`}
                key={i}
                maskUnits="userSpaceOnUse"
              >
                <rect
                  x="0"
                  y="0"
                  width={size}
                  height={size}
                  fill="#fff"
                  stroke="none"
                  rx={radius}
                />
                <path d={`M${prev.x} ${prev.y}h.01`} />
                <path d={`M${next.x} ${next.y}h.01`} />
              </mask>
            )
          );
        })}
      </g>
      <g className="svg-preview-control-path-group" {...props}>
        {controlPaths.map(({ d, showMarker }, i) => (
          <path
            key={i}
            mask={
              showMarker
                ? `url(#svg-preview-control-path-marker-mask-${i})`
                : undefined
            }
            d={d}
          />
        ))}
      </g>
      <g className="svg-preview-control-path-marker-group" {...props}>
        <path
          d={controlPaths
            .flatMap(({ prev, next, showMarker }) =>
              showMarker
                ? [`M${prev.x} ${prev.y}h.01`, `M${next.x} ${next.y}h.01`]
                : [],
            )
            .join("")}
        />
        {controlPaths.map(({ d, prev, next, startMarker, endMarker }, i) => (
          <React.Fragment key={i}>
            {startMarker && (
              <circle cx={prev.x} cy={prev.y} r={pointSize / 2} />
            )}
            {endMarker && <circle cx={next.x} cy={next.y} r={pointSize / 2} />}
          </React.Fragment>
        ))}
      </g>
    </>
  );
};

const Radii = ({
  paths,
  size,
  ...props
}: { paths: Path[]; size: number } & PathProps<
  "strokeWidth" | "stroke" | "strokeDasharray" | "strokeOpacity",
  any
>) => {
  return (
    <g className="svg-preview-radii-group" {...props}>
      {paths.map(
        ({ circle }, i) =>
          circle && (
            <React.Fragment key={i}>
              <circle
                cy={circle.y}
                cx={circle.x}
                r={0.25}
                strokeDasharray="0"
                stroke={
                  (Math.round(circle.x * 100) / 100) % 1 !== 0 ||
                  (Math.round(circle.y * 100) / 100) % 1 !== 0
                    ? "red"
                    : undefined
                }
              />
              <circle
                cy={circle.y}
                cx={circle.x}
                r={circle.r}
                stroke={
                  (Math.round(circle.r * 1000) / 1000) % 1 !== 0
                    ? "red"
                    : undefined
                }
              />
            </React.Fragment>
          ),
      )}
    </g>
  );
};

const Handles = ({
  paths,
  ...props
}: { paths: Path[] } & PathProps<
  "strokeWidth" | "stroke" | "strokeOpacity",
  any
>) => (
  <g className="svg-preview-handles-group" {...props}>
    {paths.map(({ c, prev, next, cp1, cp2 }, i) => (
      <React.Fragment key={i}>
        {cp1 && <path d={`M${prev.x} ${prev.y} ${cp1.x} ${cp1.y}`} />}
        {cp1 && <circle cy={cp1.y} cx={cp1.x} r={0.25} />}
        {cp2 && <path d={`M${next.x} ${next.y} ${cp2.x} ${cp2.y}`} />}
        {cp2 && <circle cy={cp2.y} cx={cp2.x} r={0.25} />}
      </React.Fragment>
    ))}
  </g>
);

const mSvgPathBbox = memoize(svgPathBbox);
const BoundingBox = ({
  label,
  paths,
  bounds: [x1, y1, x2, y2],
  ...props
}: {
  label: string;
  bounds: [number, number, number, number];
  paths: Path[];
} & PathProps<"stroke" | "strokeWidth" | "strokeOpacity", any>) => {
  const id = useId();
  return (
    <>
      <mask
        id={`svg-preview-bounding-box-mask-${id}`}
        maskUnits="userSpaceOnUse"
      >
        <rect x={-1} y={-1} width={26} height={26} fill="#fff" />
        <text fontSize={0.75} strokeWidth={0.4} dominantBaseline="middle">
          <textPath href={`#svg-preview-bounding-box-${id}`}>
            {label} ({Math.round(x2 - x1 + 2)}x{Math.round(y2 - y1 + 2)})
          </textPath>
        </text>
      </mask>
      <g fillOpacity={props.strokeOpacity} {...props}>
        <path
          mask={`url(#svg-preview-bounding-box-mask-${id})`}
          id={`svg-preview-bounding-box-${id}`}
          d={`M${x1} ${y1 - 1}h${x2 - x1 + 0.5}a.5 .5 0 0 1 .5 .5v${y2 - y1 + 1}a.5 .5 0 0 1 -.5 .5h-${x2 - x1 + 1}a.5 .5 0 0 1 -.5 -.5v-${y2 - y1 + 1}a.5 .5 0 0 1 .5 -.5z`}
        />
        <text
          fill={props.stroke}
          fontSize={0.75}
          strokeWidth={0.06}
          dominantBaseline="middle"
        >
          <textPath
            href={`#svg-preview-bounding-box-${id}`}
            className="svg-preview-bounding-box-label-path"
            data-ids={paths.map((p) => `${p.c.id}-${p.c.idx}`).join(" ")}
          >
            {label} ({Math.round(x2 - x1 + 2)}x{Math.round(y2 - y1 + 2)})
          </textPath>
        </text>
      </g>
    </>
  );
};

const areBoundingBoxesIntersecting = (
  a: [number, number, number, number],
  b: [number, number, number, number],
) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

const SvgPreview = React.forwardRef<
  SVGSVGElement,
  {
    size?: number;
    src: string | ReturnType<typeof getPaths>;
    showGrid?: boolean;
  } & React.SVGProps<SVGSVGElement>
>(({ src, children, size = 24, showGrid = false, ...props }, ref) => {
  const subGridSize = size % 3 === 0 ? 3 : size % 5 === 0 ? 5 : 0;
  const paths = typeof src === "string" ? getPaths(src) : src;
  const patternMatches = getPatternMatches(paths);

  const darkModeCss = `
  .dark .svg
  .dark .svg-preview-grid-group,
  .dark .svg-preview-radii-group,
  .dark .svg-preview-shadow-mask-group,
  .dark .svg-preview-shadow-group {
    stroke: ###;
  }
`;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <style>{darkModeCss}</style>
      {showGrid && (
        <Grid
          size={size}
          subGridSize={patternMatches.length ? 0 : subGridSize}
          strokeWidth={0.1}
          stroke="#777"
          strokeOpacity={0.3}
          radius={1}
        />
      )}
      <Shadow
        size={size}
        paths={paths}
        strokeWidth={4}
        stroke="#777"
        radius={1}
        strokeOpacity={0.15}
      />
      <Handles
        paths={paths}
        strokeWidth={0.12}
        stroke="#777"
        strokeOpacity={0.6}
      />
      <ColoredPath
        paths={paths}
        colors={[
          "#1982c4",
          "#4267AC",
          "#6a4c93",
          "#B55379",
          "#FF595E",
          "#FF7655",
          "#ff924c",
          "#FFAE43",
          "#ffca3a",
          "#C5CA30",
          "#8ac926",
          "#52A675",
        ]}
      />
      <Radii
        size={size}
        paths={paths}
        strokeWidth={0.12}
        strokeDasharray="0 0.25 0.25"
        stroke="#777"
        strokeOpacity={0.3}
      />
      <ControlPath
        size={size}
        radius={1}
        paths={paths}
        pointSize={1}
        stroke="#fff"
        strokeWidth={0.125}
      />
      <Handles
        paths={paths}
        strokeWidth={0.12}
        stroke="#FFF"
        strokeOpacity={0.3}
      />
      <>
        {patternMatches
          .map((patternMatch) => ({
            ...patternMatch,
            bounds: mSvgPathBbox(patternMatch.paths.map((p) => p.d).join(" ")),
          }))
          .filter(({ bounds }, idx, arr) =>
            arr.every(
              (other, otherIdx) =>
                other === arr[idx] ||
                idx < otherIdx ||
                !areBoundingBoxesIntersecting(bounds, other.bounds),
            ),
          )
          .map(({ patternName, paths, bounds }, idx) => (
            <BoundingBox
              {...props}
              key={idx}
              bounds={bounds}
              label={patternName}
              paths={paths}
              strokeWidth={0.12}
              stroke="#777"
              strokeOpacity={0.3}
            />
          ))}
      </>
      {children}
    </svg>
  );
});

SvgPreview.displayName = "SvgPreview";

export default SvgPreview;
