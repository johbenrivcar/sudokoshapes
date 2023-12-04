/*
    This script includes all the code for analysis of a sudoku grid
    to arrive at its underlying structure.

    The analysis looks at the arrangement of cells with the same numbers
    to identify their relationships and produces a standardised grid pattern code
    such that any grids which share the same underlying arrangment and differ only
    to the extent that one is a simple row, column or rotational transformation of 
    the other and/or have reassignment of number labels to the cells.

    The basic unit of structure is a "frame" which expresses the connection between
    two cells in different rows & cols that have the same label (i.e. the same number).

    There are by definition 8 frames for each different number. As there are nine numbers
    the total of frames is 8x9 = 72.


    Frames have these basic properties:
    * connect cells within the same column or row 3-group (i.e. 123, 456 or 798).
    * the number of other frames with which it shares the same two connecting numbers. 
    * the number of other frames with which it shares just one connecting number
    * 
    
    These properties are used to construct a signature of the form:
        aabbccdd 
    where aa is the total number of frames of type S that share the same two connecting numbers
          bb is the total number of frames of type D that share the same two connecting numbers
          cc is the total number of frames of type S that share just one connecting number
          dd is the total number of frames of type D that share just one connecting number
          
*/