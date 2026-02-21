# Pairwise Test Case Generator

The main algorithm is IPO, which stands for In-Parameter-Order. We build the tests by adding parameters slowlyt one at a time. We start with the first two parameters and create a small set of rows that covers all pairs between those two, excluding any pairs the user has marked as forbidden in constraints. Then we extend the list by one parameter at a time. For each existing row we choose a value for the new parameter that covers as many new pairs as possible and that does not violate the constraints. When choosing that value, we prefer values that cover pairs that only this row can cover, so we avoid adding extra rows later. After extending all existing rows, we check if any pairs involving the new parameter are still missing; for each missing pair we add a new row that covers it and fill the other columns in a way that respects the constraints. We repeat this horizontal extension and then vertical completion for every parameter until all parameters are included and every allowed pair is covered.
A small web app that generates minimal test suites covering all pairs of parameter values. Handy when you have lots of options and don’t want to test every possible combination.

**Get the project**

Clone or download the folder. If you use Git: `git clone <repo-url>` then `cd` into the project folder.

**Run it**

You need Node.js installed. In the project folder run:

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173) in your browser.

**Build for production**

```bash
npm run build
```

The built files will be in `dist/`. Use `npm run preview` to test the production build locally.
