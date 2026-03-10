"use client";

import { useState } from "react";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Menu } from "lucide-react";

const SYNAPSE_PATH =
  "M547.596558,142.588333 C542.816101,139.088135 539.528931,139.961685 535.398499,143.902679 C505.876587,172.070709 476.074402,199.945389 446.289398,227.836517 C444.050140,229.933395 443.162445,231.739395 444.580048,234.712097 C446.379822,238.486252 447.470978,242.569702 447.381409,246.787018 C447.284851,251.333038 449.774353,253.056747 453.778961,254.184998 C475.076447,260.185303 496.323700,266.364075 517.579224,272.512756 C534.844971,277.507294 552.096130,282.552094 569.357666,287.561188 C572.865112,288.579010 576.396179,289.515411 579.904907,290.528839 C582.688416,291.332825 584.471069,290.344757 586.253418,288.033112 C596.874939,274.257477 611.171875,268.451172 628.074707,271.496674 C645.434631,274.624512 657.406616,285.071381 661.381836,302.663666 C668.686157,334.988403 640.941711,358.035522 614.534607,353.845215 C609.369324,353.025635 604.396057,351.698120 599.961487,348.983429 C597.266907,347.333862 595.512878,347.936920 593.443665,349.915710 C581.047546,361.770233 568.575928,373.545746 556.130005,385.348114 C539.214661,401.388824 522.341492,417.474457 505.343414,433.426910 C502.496368,436.098816 502.034332,438.349579 503.588226,442.116028 C512.899048,464.684357 503.876404,488.278564 482.319061,498.588593 C461.453308,508.567932 436.273773,500.682495 425.179626,480.694427 C411.165680,455.445770 425.187012,423.389160 453.407745,417.309357 C463.574585,415.119019 474.072540,415.777100 483.576233,420.978851 C486.529480,422.595306 488.298889,421.941284 490.503204,419.837036 C520.385620,391.310974 550.320679,362.839966 580.281921,334.396606 C582.037781,332.729706 582.918335,331.276550 581.724426,328.794525 C579.760803,324.712402 578.901001,320.260529 578.409119,315.782196 C578.079041,312.777161 576.805969,311.078918 573.744873,310.201202 C544.790894,301.899567 515.870056,293.481842 486.946838,285.073181 C473.998047,281.308716 461.027130,277.612518 448.146637,273.625519 C443.787689,272.276276 441.057037,272.883545 438.116211,276.820618 C427.647308,290.835999 407.797363,296.021942 390.859253,289.721069 C372.826843,283.013184 362.750885,267.158630 363.721497,247.019745 C364.507416,230.712982 377.290619,215.621902 393.604614,210.750610 C404.875946,207.385056 415.387421,209.057114 425.539429,214.046921 C428.748749,215.624329 430.473511,215.032227 432.863251,212.773544 C463.129150,184.167282 493.473511,155.643829 523.864624,127.170517 C526.098022,125.078041 526.785767,123.355469 525.546143,120.287560 C513.365479,90.142624 532.448364,59.503624 564.780640,57.077938 C587.330994,55.386127 607.979675,72.538727 611.769287,96.110840 C615.240356,117.701546 600.003235,140.221039 578.666016,145.493652 C568.014343,148.125748 557.881775,146.996094 547.596558,142.588333z";

function SynapseLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 544"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="currentColor" d={SYNAPSE_PATH} />
    </svg>
  );
}

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full max-w-7xl mx-auto px-4 pt-4">
      <div className="flex flex-col overflow-hidden rounded-md border border-border/80 bg-background/50 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-background/40">
        {/* Navbar bar */}
        <div className="flex h-14 w-full items-center justify-between px-4">
          {/* Mobile: icon only on left */}
          <Link
            href="/"
            className="flex md:hidden h-full min-w-0 items-center justify-center rounded-lg py-1 font-semibold text-foreground hover:bg-muted"
            aria-label="Home"
          >
            <SynapseLogo className="size-10 text-black dark:text-white" />
          </Link>

          {/* Desktop: full nav on left */}
          <NavigationMenu className="hidden max-w-max md:block">
            <NavigationMenuList className="gap-6">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/"
                    className="flex h-full min-w-0 items-center justify-center rounded-lg py-1 font-semibold text-foreground hover:bg-transparent"
                    aria-label="Home"
                  >
                    <SynapseLogo className="size-10 text-black dark:text-white" />
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/" className={navigationMenuTriggerStyle()}>
                    Sandboxes
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link href="/ux_telemetry" className={navigationMenuTriggerStyle()}>
                    UX Telemetry
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile: Sign in/out + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="size-4" aria-hidden />
                ) : (
                  <Moon className="size-4" aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </div>

            {/* Desktop: Sign in/out + theme */}
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="ghost"
                size="lg"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="size-4" aria-hidden />
                ) : (
                  <Moon className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile: dropdown pane underneath, same width as navbar */}
        <div
          className="grid md:hidden transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: mobileMenuOpen ? "1fr" : "0fr" }}
          aria-hidden={!mobileMenuOpen}
        >
          <div className="overflow-hidden">
            <nav
              className="bg-background/40 px-4 pb-3 backdrop-blur-sm"
              aria-label="Mobile menu"
            >
              <ul className="flex flex-col gap-0.5">
                <li>
                  <Link
                    href="/"
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sandboxes
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ux_telemetry"
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    UX Telemetry
                  </Link>
                </li>
                {/* <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-foreground hover:bg-muted"
                    onClick={() => toggleTheme()}
                  >
                    {theme === "dark" ? (
                      <Sun className="size-4" aria-hidden />
                    ) : (
                      <Moon className="size-4" aria-hidden />
                    )}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                </li> */}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
