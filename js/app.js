// ---------------------------------------------------------------------------
// Feature 8: saving expenses with localStorage
// ---------------------------------------------------------------------------

// One formatter for every amount in the app. Intl is built into the browser.
const euroFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

function formatCurrency(amount) {
  return euroFormatter.format(amount);
}

// localStorage uses "keys" to store text. The version suffix (-v1) means a
// future data format change can use a new key without breaking old data.
const STORAGE_KEY = "expense-tracker-expenses-v1";

// Read the saved text and turn it back into an array.
// Three things could go wrong, so each is handled:
//   1. Nothing saved yet        -> getItem returns null
//   2. Text is not valid JSON   -> JSON.parse throws an error
//   3. Text is JSON but not []  -> Array.isArray catches the wrong shape
function loadExpenses() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
      return [];
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      console.warn("Saved expenses were not an array. Starting empty.");
      return [];
    }

    return parsed;
  } catch (error) {
    console.warn("Could not load saved expenses:", error);
    return [];
  }
}

// Turn the array into JSON text and write it to localStorage.
// If storage is blocked or full, the app keeps working in memory.
function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.warn("Could not save expenses:", error);
  }
}

// Date.now() alone can produce the same value for two expenses added in the
// same millisecond. A counter makes those IDs different: exp-<time>-1, -2...
let idCounter = 0;

function createExpenseId() {
  idCounter += 1;
  return `exp-${Date.now()}-${idCounter}`;
}

// An array of expense objects. This array is the "single source of truth":
// the screen is always built from whatever is in here.
// It uses `let` because filter() and map() return a new array.
// The starting value now comes from localStorage (or [] on first visit).
let expenses = loadExpenses();

// The <ul> that will hold the rendered rows.
const expenseList = document.querySelector("#expense-list");

// The form and its four controls (Feature 2).
const expenseForm = document.querySelector("#expense-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const submitButton = document.querySelector("#submit-btn");
const cancelEditButton = document.querySelector("#cancel-edit");
const formCard = document.querySelector("#form-card");

// Editing state (Feature 7): null means add mode, an id means edit mode.
let editingId = null;

// Error message containers (Feature 3).
const descriptionError = document.querySelector("#description-error");
const amountError = document.querySelector("#amount-error");

// Summary elements (Feature 5).
const totalElement = document.querySelector("#total");
const expenseCountElement = document.querySelector("#expense-count");
const categoryTotalsElement = document.querySelector("#category-totals");

// Average expense.
const averageElement = document.querySelector("#average");

// Filter controls and their state (Feature 6).
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const sortSelect = document.querySelector("#sort-select");

// Filter clear button.
const clearFiltersButton = document.querySelector("#clear-filters");

// Form header.
const formHeading = document.querySelector("#form-heading");

// Reset data button.
const resetButton = document.querySelector("#reset-data");


const filters = {
  search: "",
  category: "all",
  // Sort is view state only. It is never saved to localStorage.
  sort: "newest",
};

// ---------------------------------------------------------------------------
// Sorting (Feature 9)
// ---------------------------------------------------------------------------

// Compare two dates stored as "YYYY-MM-DD" strings.
// direction: 1 = oldest first, -1 = newest first.
// Empty dates always go last, whichever direction is chosen.
function compareDates(a, b, direction) {
  if (a.date === "" && b.date === "") {
    return 0;
  }

  if (a.date === "") {
    return 1;
  }

  if (b.date === "") {
    return -1;
  }

  // "YYYY-MM-DD" is fixed-width, so alphabetical order is date order.
  return direction * a.date.localeCompare(b.date);
}

// A comparison function asks the browser how to order two items.
// Negative = a first, positive = b first, zero = keep relative order.
function compareExpenses(a, b) {
  switch (filters.sort) {
    case "oldest":
      return compareDates(a, b, 1);

    case "amount-high":
      return b.amount - a.amount;

    case "amount-low":
      return a.amount - b.amount;

    case "newest":
    default:
      return compareDates(a, b, -1);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getVisibleExpenses() {
  const matches = expenses.filter((expense) => {
    const matchesSearch = expense.description
      .toLowerCase()
      .includes(filters.search);

    const matchesCategory =
      filters.category === "all" || expense.category === filters.category;

    return matchesSearch && matchesCategory;
  });

  // Copy before sorting. sort() reorders IN PLACE, and `expenses` must
  // never be reordered — it is the saved source of truth.
  const sorted = [...matches].sort(compareExpenses);

  return sorted;
}

// Build a consistent empty state: a short title and a helpful hint.
function createEmptyState(title, hint) {
  const item = document.createElement("li");
  item.className = "empty-state";

  const titleElement = document.createElement("p");
  titleElement.className = "empty-title";
  titleElement.textContent = title;

  const hintElement = document.createElement("p");
  hintElement.className = "empty-hint";
  hintElement.textContent = hint;

  item.append(titleElement, hintElement);
  return item;
}

function renderExpenses() {
  // The list shows only expenses that pass the filters.
  // The original `expenses` array is never modified.
  const visibleExpenses = getVisibleExpenses();

  // Start from an empty list so re-rendering never duplicates rows.
  // Setting textContent to "" removes every child element.
  expenseList.textContent = "";

  // Empty state: there are no expenses at all.
  if (expenses.length === 0) {
    expenseList.append(
      createEmptyState(
        "No expenses yet",
        "Add your first expense using the form above."
      )
    );

    console.log("Rendered 0 expenses.");
    return;
  }

  // Separate empty state: expenses exist, but none match the filters.
  if (visibleExpenses.length === 0) {
    expenseList.append(
      createEmptyState(
        "No matching expenses",
        "Try a different search term or category."
      )
    );

    console.log(`Rendered 0 of ${expenses.length} expenses.`);
    return;
  }

  for (const expense of visibleExpenses) {
    // 1. The row container: <li class="expense-item">
    const row = document.createElement("li");
    row.className = "expense-item";

    // 2. The description: <span class="expense-description">
    const description = document.createElement("span");
    description.className = "expense-description";
    description.textContent = expense.description;

    // 3. The category and date: <span class="expense-meta">
    const meta = document.createElement("span");
    meta.className = "expense-meta";
    meta.textContent = `${expense.category} · ${expense.date || "No date"}`;

    // 4. The amount: <span class="expense-amount">
    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatCurrency(expense.amount);

    // 5. The action buttons: Edit and Delete.
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-btn";
    editButton.dataset.id = expense.id;
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${expense.description}`);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.dataset.id = expense.id;
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${expense.description}`);

    const actions = document.createElement("div");
    actions.className = "expense-actions";
    actions.append(editButton, deleteButton);

    // 6. Put everything inside the row, then the row inside the list.
    row.append(description, meta, amount, actions);
    expenseList.append(row);
  }

  console.log(`Rendered ${visibleExpenses.length} of ${expenses.length} expenses.`);
}

function renderSummary() {
  // Derived value: add every amount, starting from 0.
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  totalElement.textContent = formatCurrency(total);
  expenseCountElement.textContent = expenses.length;

  const average = expenses.length === 0 ? 0 : total / expenses.length;
  averageElement.textContent = formatCurrency(average);
  
  // Derived value: group amounts by category in a plain object.
  const totalsByCategory = expenses.reduce((totals, expense) => {
    if (totals[expense.category] === undefined) {
      totals[expense.category] = 0;
    }

    totals[expense.category] += expense.amount;
    return totals;
  }, {});

  categoryTotalsElement.textContent = "";

  const categories = Object.keys(totalsByCategory);

  if (categories.length === 0) {
    categoryTotalsElement.append(
      createEmptyState(
        "No category totals yet",
        "Add an expense to see spending by category."
      )
    );
    return;
  }

  for (const category of categories) {
    const row = document.createElement("li");
    row.className = "category-total";

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category;

    const amount = document.createElement("span");
    amount.className = "category-amount";
    amount.textContent = formatCurrency(totalsByCategory[category]);

    row.append(name, amount);
    categoryTotalsElement.append(row);
  }
}

// Redraw every view from the same source of truth.
function renderApp() {
  renderExpenses();
  renderSummary();
}

// ---------------------------------------------------------------------------
// Adding an expense (Features 2 & 3)
// ---------------------------------------------------------------------------

function clearErrors() {
  descriptionError.textContent = "";
  amountError.textContent = "";

  // Removing aria-invalid marks the field as valid again.
  descriptionInput.removeAttribute("aria-invalid");
  amountInput.removeAttribute("aria-invalid");
}

function resetFormMode() {
  editingId = null;
  formCard.classList.remove("is-editing");
  expenseForm.reset();
  submitButton.textContent = "Add expense";
  cancelEditButton.hidden = true;
  formHeading.textContent = "Add an expense";
  clearErrors();
}

function handleFormSubmit(event) {
  // A form's default action is to reload the page. Cancel that and
  // handle the submission ourselves.
  event.preventDefault();

  // Remove messages from the previous attempt before validating again.
  clearErrors();

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);

  // null means "no invalid field found yet".
  let firstInvalidInput = null;

  if (description === "") {
    descriptionError.textContent = "Please enter a description.";
    descriptionInput.setAttribute("aria-invalid", "true");

    if (firstInvalidInput === null) {
      firstInvalidInput = descriptionInput;
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    amountError.textContent = "Please enter a valid amount greater than zero.";
    amountInput.setAttribute("aria-invalid", "true");

    if (firstInvalidInput === null) {
      firstInvalidInput = amountInput;
    }
  }

  // If anything failed, stop before creating the expense.
  if (firstInvalidInput !== null) {
    firstInvalidInput.focus();
    return;
  }

  if (editingId === null) {
    // Add mode: create a brand-new expense.
    const newExpense = {
      // A unique ID that will not clash with saved IDs after a refresh.
      id: createExpenseId(),
      description: description,
      amount: amount,
      category: categoryInput.value,
      date: dateInput.value,
    };

    expenses.push(newExpense);
  } else {
    // Edit mode: replace only the matching expense.
    // map() returns a new array of the same length.
    expenses = expenses.map((expense) => {
      if (expense.id !== editingId) {
        return expense;
      }

      // Spread copies every old property, including the original id,
      // then we override only the fields the user can change.
      return {
        ...expense,
        description: description,
        amount: amount,
        category: categoryInput.value,
        date: dateInput.value,
      };
    });
  }

  // Both add and edit end up here, so one save covers both.
  saveExpenses();
  resetFormMode();
  renderApp();
}

expenseForm.addEventListener("submit", handleFormSubmit);

cancelEditButton.addEventListener("click", () => {
  resetFormMode();
});

// ---------------------------------------------------------------------------
// Deleting an expense (Feature 4)
// ---------------------------------------------------------------------------

function handleDeleteClick(event) {
  // event.target is whatever was clicked. closest() walks up from there
  // until it finds a Delete button, or returns null.
  const deleteButton = event.target.closest(".delete-btn");

  if (deleteButton === null) {
    return;
  }

  const idToDelete = deleteButton.dataset.id;

  // filter() returns a NEW array containing every expense whose id does
  // not match the one being deleted.
  expenses = expenses.filter((expense) => expense.id !== idToDelete);

  // Persist the deletion before anything is re-rendered.
  saveExpenses();

  // If the deleted expense was being edited, leave edit mode.
  if (editingId === idToDelete) {
    resetFormMode();
  }

  renderApp();
}

// One listener on the list handles every Delete button, including buttons
// created by future renders.
expenseList.addEventListener("click", handleDeleteClick);

// ---------------------------------------------------------------------------
// Editing an expense (Feature 7)
// ---------------------------------------------------------------------------

function handleEditClick(event) {
  const editButton = event.target.closest(".edit-btn");

  if (editButton === null) {
    return;
  }

  const idToEdit = editButton.dataset.id;
  const expenseToEdit = expenses.find((expense) => expense.id === idToEdit);

  if (expenseToEdit === undefined) {
    return;
  }

  editingId = idToEdit;
  formCard.classList.add("is-editing");

  descriptionInput.value = expenseToEdit.description;
  amountInput.value = expenseToEdit.amount;
  categoryInput.value = expenseToEdit.category;
  dateInput.value = expenseToEdit.date;

  submitButton.textContent = "Save Changes";
  cancelEditButton.hidden = false;
  formHeading.textContent = `Editing: ${expenseToEdit.description}`; 

  clearErrors();
  descriptionInput.focus();
}

expenseList.addEventListener("click", handleEditClick);

// ---------------------------------------------------------------------------
// Filtering and searching (Feature 6)
// ---------------------------------------------------------------------------

function handleFilterChange() {
  // Keep the search text lowercase so includes() is case-insensitive.
  filters.search = searchInput.value.trim().toLowerCase();
  filters.category = categoryFilter.value;
  filters.sort = sortSelect.value;

  // Only the list depends on filters; the summary still uses all expenses.
  renderExpenses();
}

// "input" fires on every keystroke; "change" fires when the select changes.
searchInput.addEventListener("input", handleFilterChange);
categoryFilter.addEventListener("change", handleFilterChange);
sortSelect.addEventListener("change", handleFilterChange);

// Run once when the page loads.
renderApp();

// Clear filter.
clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "all";
  handleFilterChange();
});

// Reset data button.
resetButton.addEventListener("click", () => {
  if (window.confirm("Delete all expenses permanently?")) {
    expenses = [];
    localStorage.removeItem(STORAGE_KEY);
    renderApp();
  }
});

