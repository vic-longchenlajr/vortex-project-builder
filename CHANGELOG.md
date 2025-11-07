**Version Control Log:**

_v2.1.0_

Universal Updates

- Sorted nozzle display by descreasing orifice size and operating pressure
- Refined status panel and centralized wording.

Engineered System Updates

- Added "System Results" table which identifies zone driving nitrogen storage, total cylinders, total n2 requirement, zone driving water storage, minimum water tank requirement, and provided water tank.
- Added number of panels to zone results.
- Added separate panel sizing and calculations to account for multiple nozzle operating pressures.

Pre-Engineered System Updates

- Added provided water tank to system results and moved it into system options.
- Added emitter layout

_v2.0.0_

Universal Updates

- Rebuilt core architecture
- New project hierarchy
- Live validation system
- JSON project files
- Excel export overhaul
- Offline/desktop compatibility
- Autosave & restore
- New UI and navigation

Engineered System Updates

- Unified engineered calculation engine
- Zone-level grouping by nitrogen source
- Refined validation and error checking

Pre-Engineered System Updates

- Updated input/results layout

--

_v1.1.4_

Universal Updates

- Added unfilled cylinders for euro configurations
- 6.5% increase to all parts in the price listing
- Discharge time flag based off of nitrogen group instad of enclosure
- Flagged if nitrogen source group contains multiple emitter set pressures
- Updated method of calculating Fire Alarm Control Points and displaying the quantity in the bill of material.

Engineered Updates

- Added cylinder counts for nitrogen source groups

Pre-Engineered Updates

- Fixed inaccurate o2 level bug where cylinder capacities were the same regardless of cylinder psi selection

--

_v1.1.3_

Universal Updates

- Reverted design method descriptions back to previous wording

Engineered Updates

- Added checks for multiple enclosure, single nitrogen source design method compatibility (Inaccsessible, still under testing)

Pre-Engineered Updates

- Patched bug where emitter spacing requirements were incorrectly calculated when metric units are selected.

--

_v1.1.2_

Universal Updates

- Updated logic of adding FM required labels

Pre-Engineered Updates

- Added back CE/ASME/FM and CE water tanks as configuration options

--

_v1.1.1_

Universal Updates

- Added FM required labels to both configurators

Engineered Updates

- Fixed issue where incompatible emitter style selection throws error

Pre-Engineered Updates

- Removed 49L cylinder calculations for projects selecting Euro or GBP as the currency

--

_v1.1.0_

Universal Updates

- List Prices increased by 6%
- Added currency selection for USD, Euro, and GBP.
- M3 partcodes are loaded into BOM when any non-USD currency is selected.

Pre-Engineered Updates

- First live version with pre-engineered configurator included.
- Consolidated cylinders
- Unit Change

--

_v1.0.8_

- Increased amount of visible characters in the volume input.

- Updated partcode for 48" length IGS flexible hose to account for single orders rather than box orders.

--

_v1.0.7_

Pre-Engineered Updates

- FM Data centers default to 5/8" emitter instead of 3/8"

- Fixed inaccuracy of 49L/80L cylinder partcodes

- Fixed default emitter incorrectly displaying

- Added 2640 psi cylinder options for 80L configurations

Engineered Updates

- Cap FM Data Center volumes at 31,350ft

- Fixed part description for Engineered Manual

- Added emitter style selection

--

_v1.0.6_

Pre-Engineered Updates

- Added emitter size @ operating pressure selection menu for FM Data Centers

- Updated spacing requirement tables in generated bill of material and on the configurator

Engineered Updates

- Fixed bug where Pre-Engineered manual and other Pre-Engineered parts were being populated into the generated bill of material.

- Fixed bug where edit emitter checkbox was populating the wrong emitter in Class B applications

--

_v1.0.5_

Pre-Engineered Updates

- Added warning disclosure on configurator screen and Vortex System

- Increased height of status bar to reduce the need to scroll

- Removed unapproved water tank certifications

- Removed the option to edit Release/Monitor Points

- Added Enclosure and Spacing Requirements (for pendent and sidewall emitters)

- Updated single/multi emitter pipe tables to reflect manual changes

- Added Enclosre/Spacing Reqiruements to Piping Guidelines tab in Excel output

- Made water flex lines a standard issue for projects rather than an add-on

- Added fill pressure next to cylinder selection

- Removed PVDF emitters from configurator

- Added Example Volume Calculations Page

UI Updates

- Redesigned home page to add engineered/preengineered selection with corresponding design method and manual info

- Updated site-wide fonts

--

_v1.0.4_

Pre-Engineered Updates

- Updated price listing & added new price listing to FTP

- Added back primary and secondary pilot kits

- Fixed minimum discharge time for Performance Based Designs

- Added light email functionality for project bill of material submission

--

_v1.0.3_

Pre-Engineered Updates

- Fixed some wordings on the status updates

- Updated calculator to round the oxygen level to 1 decimal place prior to error checking

- Implemented 2.2 min minimum discharge time for performance based designs

- Fixed nozzle inconsistencies across all design methods.

- Added selection of emitter material for performance based designs

- Dismantled volume into a length x width x height input to allow for error checking in allowable room dimensions (FMDC)

- Swapped label for emitter and cylinder quantities so that emitter configuration info is next to eachother

- Renamed selectable design method to Perf. Based (NFPA 770) Class A/B to standardize with wording used in the manuals

--

_v1.0.2_

- Updated method for estimating amount of Adjacent Rack and Double Stack Rack Hoses for each Pre-Engineered system.

- Removed editable cylinder/emitter quantities & emitter size @ operating pressure for Pre-Engineered systems. Currently calculating optimal configuration based off of system configuration.

- Removed fill pressure options and added configuration for both 49L and 80L cylinders in Pre-Engineered systems.

--

_v1.0.1_

- Added Vortex Engineered/Preengineered IOM partcode to corresponding BOMs.

- Added cylinder partcode to generated Preengineered BOMs.

- Removed engineered cylinder storage racking from generated Preengineered BOMs.

--

_v1.0.0_

- 3/12/2024

- First version available for public usage

- Only contains engineered configurator (preengineered located at /preengineered)

- Email functionality removed

- Updated Design
  - Added smooth scrolling to sectioned part of landing page
  - Added cylinder graphic to landing page
  - Added links to manuals with description and title
  - Version number displayed at the bottom of the landing page
  - Reduced font size in opening paragraph

--

_v0.2.3_

- 2/29/2024

- Added HELP.md: Document about how to navigate and make changes to the configurator.

- Updated Calculator
  - Added manifold plugs, cylinder refill adapter options, 1” emitter (FM DC)
  - Updated oxygen error verbiage and revised oxygen error checking
  - General bug fixes
  - Pre-Engineered calculator caps the cylinder count at 8 cylinders and calculates hypothetical

- Updated BOM
  - Added updated combination panel partcodes
  - Switched partcode/quantity columns for easier margin analysis
  - Updated piping rules

- Updated Design
  - Implemented Monica’s design changes throughout the entire site
- Updated ZoneTable
  - Replaced redundant emitter selection value with flow cartridge selection value

--

_v0.2.2_

- 1/30/2024

- Updated Calculator
  - Added new restrictions to Pre-Engineered/Engineered Volume
  - Implemented associated FRCP points into the part object items

- Update BOM
  - Include Error/Warning tab for all active errors and warnings that are produced
  - Disclaimer added when an emitter or cylinder quantity is modified from the original value
  - Added a page about estimated FRCP points
  - Include piping guidelines in pre-engineered output

- Update Info Popup
  - Added info disclaimer about the different volume restrictions

- Additional Customization
  - Added edit emitter/cylinder quantity for FM Data Centers, FM Machine Spaces, and FM Turbines (Pre-Engineered and Engineered)
  - Added option to edit Emitter Size @ Operating Pressure for FM Data Centers and NFPA 770 Class A&B (Engineered)

--

_v0.2.1_

- 12/7/2023

- Version pushed with edit emitter/cylinder functionality in both Engineered and Pre-Engineered systems for NFPA 770 design methods. (primary focus of testing)

- Pre-Engineered export bill of materials condensed to one part list

-- Pre-Engineered piping table updates to reflect minimum distance to prevent freezing & clarified between nitrogen vs water piping sizes

- Add-ons: Default doors amount to 1

- Bulk tube disclaimer to reflect purchasing method

--

_v0.2.0_

- 11/15/2023

- Immediately following the push of v0.1.3

- First version uploaded with Pre-Engineered Estimator Tool functionality

- Expedited per Daniel Wake's request to use both estimators in a presentation

- Added toggle edit button for Emitter and Cylinder quantities for NFPA 770 design methods. Feature implemented and tested (not extensively)

- Added status bar error checking for discharge time and O2 levels when edit quantities are selected.

--

_v0.1.3_

- 11/3/2023

- Pushed after phase 2 testing and feedback

- Added discount multiplier.

- Fixed discharge time miscalculations on FM Machine Spaces and FM Turbines.

- Added info popup bubbles to assist designers with potentially confusing labels.

- Formatted Volume and Temperature column labels.

- Limited amount of zones to 100 zones.

--

_v0.1.2_

- 10/6/2023

- Pushed after Phase 1 testing and feedback

- Moved email address field below the phone number to accomodate longer email addresses.

- Added disclaimer for tool only estimating for single enclosure zones. (located in landing page)

- Handled status bar error for non-FM approved water tank for FM design methods.

--

_v0.1.1_

- 10/4/2023

- Created Log

- Fixed bug where selection of FM Turbines or FM Machine Spaces completely broke calculator and site.
  - Did not set Hybrid Emitter Nitrogen Flow when calculating emitters.

- Added login/password component but will not make active until testing expands further.

- Removing preengineered feature before deployment

--

_v0.1.0_

- 10/2/2023

- First version released for testing/feedback

- Feedback form located at `https://forms.office.com/r/RxHLYbevwa`
