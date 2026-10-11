const createWeek = (name) => ({ name, هزینه: 0, درآمد: 0 });

function weekIndex(item) {
  const match = /^(?:\d{3,4})\/\d{1,2}\/(\d{1,2})$/.exec(String(item?.date || ""));
  const day = match ? Number(match[1]) : 0;
  return day >= 1 && day <= 31 ? Math.min(3, Math.floor((day - 1) / 7)) : -1;
}

export function buildWeeklyFinancialData(expenses = [], incomes = []) {
  const weeks = [1, 2, 3, 4].map((n) => createWeek(`هفته ${n}`));
  const withoutDate = createWeek("بدون تاریخ");

  expenses.forEach((expense) => {
    const index = weekIndex(expense);
    (index < 0 ? withoutDate : weeks[index]).هزینه += Number(expense?.amount) || 0;
  });
  incomes.forEach((income) => {
    const index = weekIndex(income);
    (index < 0 ? withoutDate : weeks[index]).درآمد += Number(income?.amount) || 0;
  });

  return withoutDate.هزینه || withoutDate.درآمد ? [...weeks, withoutDate] : weeks;
}
