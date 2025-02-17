module.exports = {
  VariableCard: {
    SIZING: {
      HEIGHT: 38,
      MIN_WIDTH: 5,
      TITLE_UPPER_RECT_HEIGHT: 10,
      TITLE_LOWER_RECT_HEIGHT: 10,
      TITLE_HEIGHT: 20,
      OUTLINE_WIDTH: 1,
      CORNER_RADIUS: 10,
      SPACE_BETWEEN: 10,
      ARRAY_SPACE_BETWEEN: 0,
      ROUNDED_PADDING: 5,
      ORIGIN_Y_OFFSET: 32
    },
    ALIGNMENT: {
      TITLE: "center",
      VALUE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 12,
      BODY_SIZE: 15
    },
    COLORS: {
      BODY: "white",
      REF_BODY: "#d7d4f0",
      TYPES: {
        "bool": "#dedd95",
        "char": "#ee94bc",
        "double": "#df9be9",
        "int": "#9ccafd",
        "long int": "#beafff",
        "ptr": "#89e1df",
        "string": "#ffcead",
        "ref": "#beafff",
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
      THRESHOLD_SUPER_CLOSE_X: 150,
      BOLD_WIDTH: 2,
      NORMAL_WIDTH: 1,
      INTERMEDIATE_PADDING: 50,
      ORIGIN_Y_SHIFTER: 3
    }

  },
  StackFrameCard: {
    SIZING: {
      MIN_WIDTH: 20,
      MIN_HEIGHT: 50,
      TITLE_HEIGHT: 20,
      OUTLINE_WIDTH: 1,
      CORNER_RADIUS: 10,
      OFFSET: 10,
      RECT_LOWER_HEIGHT: 15,
      RECT_UPPER_HEIGHT: 20,
      ORIGIN_Y_OFFSET: 35
    },
    ALIGNMENT: {
      TITLE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 18
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
    PADDING: 70,
    KONVA_PADDING: 2,
    SPLIT_LINE: {
      COLOR: "#e2e2e2",
      WIDTH: 1
    },
    STAGE_Y_OFFSET: 42,
    TITLE_Y_OFFSET: 8,
    TITLE_UNDERLINE_Y_OFFSET: 27,
    FONT: {
      SIZE: 15,
      FAMILY: "Menlo, monospace",
      STYLE: "bold",
      ALIGNMENT: "center",
      COLOR: "#a9a9a9"
    }
  }
};
