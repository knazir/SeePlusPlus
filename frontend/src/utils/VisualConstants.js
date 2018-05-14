module.exports = {
  VariableCard: {
    SIZING: {
      HEIGHT: 44,
      MIN_WIDTH: 5,
      TITLE_UPPER_RECT_HEIGHT: 20,
      TITLE_LOWER_RECT_HEIGHT: 10,
      TITLE_HEIGHT: 20,
      OUTLINE_WIDTH: 1,
      CORNER_RADIUS: 15,
      SPACE_BETWEEN: 10,
      ARRAY_SPACE_BETWEEN: 0
    },
    ALIGNMENT: {
      TITLE: "center",
      VALUE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 15,
      BODY_SIZE: 20
    },
    COLORS: {
      BODY: "white",
      TYPES: {
        "bool": "#dedd95",
        "char": "#ee94bc",
        "double": "#df9be9",
        "int": "#9ccafd",
        "long int": "#beafff",
        "pointer": "#89e1df",
        "string": "#ffcead",
        ORPHANED: "#ea9e9d",
        DEFAULT: "#b3ea99"
      }
    },
    POINTER: {
      WIDTH: 12,
      LENGTH: 7,
      COLOR: "black",
      Y_OFFSET: 32,
      RADIUS: 3,
      TENSION: 0,
      ARROW_OFFSET: 3,
      THRESHOLD_SUPER_CLOSE_Y: 50,
      THRESHOLD_SUPER_CLOSE_X: 100,
      BOLD_WIDTH: 4,
      NORMAL_WIDTH: 2
    }

  },
  StackFrameCard: {
    SIZING: {
      MIN_WIDTH: 20,
      MIN_HEIGHT: 50,
      TITLE_HEIGHT: 30,
      OUTLINE_WIDTH: 1,
      CORNER_RADIUS: 15
    },
    ALIGNMENT: {
      TITLE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 20
    },
    COLORS: {
      BODY: "white",
      ACTIVE: "#92edb6",
      INACTIVE: "rgb(197, 204, 216)"
    }
  },
  DomCard: {
    TITLE_HEIGHT: 31
  },
  Visualization: {
    PADDING: 80
  }
};
