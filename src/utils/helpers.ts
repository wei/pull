export const getRandomCronSchedule = () => {
  // Every 8 hours at a random minute
  const randomMinute = Math.floor(Math.random() * 60);
  const randomHour1 = Math.floor(Math.random() * 8);
  const randomHour2 = randomHour1 + 8;
  const randomHour3 = randomHour2 + 8;
  return `${randomMinute} ${randomHour1},${randomHour2},${randomHour3} * * *`;
};
