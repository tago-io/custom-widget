interface ITagoIO {
  onError: (error: string) => void;
}

interface Window {
  TagoIO: ITagoIO;
}

// ? Function should be wrapped to avoid duplicate variable names
((): void => {
  window.TagoIO = {
    onError: (error) => console.log(error),
  } as ITagoIO;

  console.log(window.TagoIO);
})();
